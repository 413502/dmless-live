/**
 * db.ts — File-based persistent JSON database
 *
 * Stores all data in /data/db.json (project root).
 * Uses a globalThis singleton to cache in memory between requests
 * within the same Node process, and flushes to disk on every write.
 *
 * Vercel note: /data is writable in dev. In Vercel production,
 * the filesystem is read-only for deployed code but writable at /tmp.
 * For Vercel prod, point DATA_PATH to /tmp/db.json or use Vercel KV.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MCQ {
  id: string;
  question: string;
  options: string[]; // exactly 4
  correctIndex: number; // 0–3
}

export interface Job {
  id: string;
  recruiterId: string;
  title: string;
  description: string;
  mcqs: MCQ[];
  status: 'open' | 'closed';
  timeLimitMinutes: number;   // 0 = no limit
  maxAttempts: number;        // 0 = no limit (default 1)
  createdAt: string;
  updatedAt: string;
}

export interface CandidateSubmission {
  id: string;
  jobId: string;
  email: string;
  name: string;
  status: 'knocked_out' | 'shortlisted' | 'hired' | 'rejected_after_screening';
  knockoutMcqIndex?: number;
  answers: number[];          // what they selected per question
  resumeFileName?: string;
  resumeSize?: number;
  resumeMimeType?: string;
  resumeUrl?: string;
  attemptedAt: string;
  completedAt?: string;
  attemptNumber: number;      // which attempt (1-based)
  timeTakenSeconds?: number;
}

export interface Recruiter {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

export interface DB {
  recruiters: Record<string, Recruiter>;
  jobs: Record<string, Job>;
  submissions: Record<string, CandidateSubmission>;
  // key = "jobId:email" → attempt count
  attemptCounts: Record<string, number>;
}

// ── File path ─────────────────────────────────────────────────────────────────

function getDataPath(): string {
  // In Vercel production, use /tmp (writable). In dev, use project /data dir.
  if (process.env.VERCEL && process.env.NODE_ENV === 'production') {
    return '/tmp/dmless-db.json';
  }
  return path.join(process.cwd(), 'data', 'db.json');
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Singleton cache ───────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __dmless_db: DB | undefined;
}

function emptyDB(): DB {
  return { recruiters: {}, jobs: {}, submissions: {}, attemptCounts: {} };
}

function loadFromDisk(): DB {
  const filePath = getDataPath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DB>;
      return {
        recruiters: parsed.recruiters ?? {},
        jobs: parsed.jobs ?? {},
        submissions: parsed.submissions ?? {},
        attemptCounts: parsed.attemptCounts ?? {},
      };
    }
  } catch (e) {
    console.error('[dmless] Failed to read db.json, starting fresh:', e);
  }
  return emptyDB();
}

function getDB(): DB {
  if (!globalThis.__dmless_db) {
    globalThis.__dmless_db = loadFromDisk();
  }
  return globalThis.__dmless_db;
}

function persist() {
  const db = getDB();
  const filePath = getDataPath();
  try {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('[dmless] Failed to persist db.json:', e);
  }
}

// ── Recruiter helpers ─────────────────────────────────────────────────────────

export function createRecruiter(email: string, password: string, name: string): Recruiter {
  const db = getDB();
  const normalised = email.toLowerCase().trim();
  const existing = Object.values(db.recruiters).find(r => r.email === normalised);
  if (existing) throw new Error('An account with this email already exists');

  const r: Recruiter = {
    id: uuidv4(),
    email: normalised,
    password,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  db.recruiters[r.id] = r;
  persist();
  return r;
}

export function findRecruiterByEmail(email: string): Recruiter | undefined {
  const db = getDB();
  const normalised = email.toLowerCase().trim();
  return Object.values(db.recruiters).find(r => r.email === normalised);
}

export function findRecruiterById(id: string): Recruiter | undefined {
  return getDB().recruiters[id];
}

// ── Job helpers ───────────────────────────────────────────────────────────────

export function createJob(data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Job {
  const db = getDB();
  const mcqs = data.mcqs.map(m => ({ ...m, id: m.id || uuidv4() }));
  const now = new Date().toISOString();
  const job: Job = {
    ...data,
    mcqs,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
  db.jobs[job.id] = job;
  persist();
  return job;
}

export function getJob(id: string): Job | undefined {
  return getDB().jobs[id];
}

export function getJobsByRecruiter(recruiterId: string): Job[] {
  return Object.values(getDB().jobs).filter(j => j.recruiterId === recruiterId);
}

export function updateJob(id: string, updates: Partial<Omit<Job, 'id' | 'recruiterId' | 'createdAt'>>): Job | undefined {
  const db = getDB();
  const job = db.jobs[id];
  if (!job) return undefined;
  const updated: Job = {
    ...job,
    ...updates,
    id: job.id,
    recruiterId: job.recruiterId,
    createdAt: job.createdAt,
    updatedAt: new Date().toISOString(),
    // re-stamp MCQ IDs if MCQs were updated
    mcqs: updates.mcqs
      ? updates.mcqs.map(m => ({ ...m, id: m.id || uuidv4() }))
      : job.mcqs,
  };
  db.jobs[id] = updated;
  persist();
  return updated;
}

export function updateJobStatus(id: string, status: 'open' | 'closed'): Job | undefined {
  return updateJob(id, { status });
}

// ── Submission & attempt helpers ──────────────────────────────────────────────

function attemptKey(jobId: string, email: string) {
  return `${jobId}:${email.toLowerCase().trim()}`;
}

export function getAttemptCount(jobId: string, email: string): number {
  const db = getDB();
  return db.attemptCounts[attemptKey(jobId, email)] ?? 0;
}

export function canAttempt(jobId: string, email: string): boolean {
  const job = getJob(jobId);
  if (!job) return false;
  const count = getAttemptCount(jobId, email);
  const max = job.maxAttempts > 0 ? job.maxAttempts : 1; // default = 1
  return count < max;
}

export function createSubmission(
  data: Omit<CandidateSubmission, 'id' | 'attemptedAt' | 'attemptNumber'>
): CandidateSubmission {
  const db = getDB();
  const key = attemptKey(data.jobId, data.email);

  const current = db.attemptCounts[key] ?? 0;
  const job = db.jobs[data.jobId];
  const max = job ? (job.maxAttempts > 0 ? job.maxAttempts : 1) : 1;

  if (current >= max) throw new Error('Attempt limit reached');

  db.attemptCounts[key] = current + 1;

  const sub: CandidateSubmission = {
    ...data,
    email: data.email.toLowerCase().trim(),
    id: uuidv4(),
    attemptedAt: new Date().toISOString(),
    attemptNumber: current + 1,
  };
  db.submissions[sub.id] = sub;
  persist();
  return sub;
}

export function updateSubmission(id: string, updates: Partial<CandidateSubmission>): CandidateSubmission | undefined {
  const db = getDB();
  const sub = db.submissions[id];
  if (!sub) return undefined;
  db.submissions[id] = { ...sub, ...updates };
  persist();
  return db.submissions[id];
}

export function getSubmissionById(id: string): CandidateSubmission | undefined {
  return getDB().submissions[id];
}

export function getSubmissionsByJob(jobId: string): CandidateSubmission[] {
  return Object.values(getDB().submissions).filter(s => s.jobId === jobId);
}

export function getSubmissionByJobAndEmail(jobId: string, email: string): CandidateSubmission | undefined {
  const normalised = email.toLowerCase().trim();
  // Return the most recent attempt
  return Object.values(getDB().submissions)
    .filter(s => s.jobId === jobId && s.email === normalised)
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface JobAnalytics {
  totalApplied: number;
  knockedOut: number;
  shortlisted: number;
  mcqFailureRates: {
    question: string;
    failureCount: number;
    totalAttempts: number;
    rate: number;
  }[];
  highestFailureMcq: string | null;
}

export function getJobAnalytics(jobId: string): JobAnalytics {
  const job = getJob(jobId);
  const subs = getSubmissionsByJob(jobId);
  const totalApplied = subs.length;
  const knockedOut = subs.filter(s => s.status === 'knocked_out').length;
  const shortlisted = subs.filter(s => s.status === 'shortlisted').length;

  if (!job) {
    return { totalApplied, knockedOut, shortlisted, mcqFailureRates: [], highestFailureMcq: null };
  }

  const failureCounts = job.mcqs.map(() => 0);
  const attemptCounts = job.mcqs.map(() => 0);

  for (const sub of subs) {
    if (sub.status === 'knocked_out' && sub.knockoutMcqIndex !== undefined) {
      for (let i = 0; i <= sub.knockoutMcqIndex; i++) attemptCounts[i]++;
      failureCounts[sub.knockoutMcqIndex]++;
    } else if (sub.status === 'shortlisted') {
      for (let i = 0; i < job.mcqs.length; i++) attemptCounts[i]++;
    }
  }

  const mcqFailureRates = job.mcqs.map((mcq, i) => ({
    question: mcq.question,
    failureCount: failureCounts[i],
    totalAttempts: attemptCounts[i],
    rate: attemptCounts[i] > 0 ? Math.round((failureCounts[i] / attemptCounts[i]) * 100) : 0,
  }));

  const withFailures = mcqFailureRates.filter(m => m.failureCount > 0);
  const highest = withFailures.sort((a, b) => b.rate - a.rate)[0] ?? null;

  return {
    totalApplied,
    knockedOut,
    shortlisted,
    mcqFailureRates,
    highestFailureMcq: highest?.question ?? null,
  };
}

export function getDashboardStats(recruiterId: string) {
  const myJobs = getJobsByRecruiter(recruiterId);
  let totalApplied = 0, knockedOut = 0, shortlisted = 0;
  for (const job of myJobs) {
    const a = getJobAnalytics(job.id);
    totalApplied += a.totalApplied;
    knockedOut += a.knockedOut;
    shortlisted += a.shortlisted;
  }
  return { totalApplied, knockedOut, shortlisted, totalJobs: myJobs.length };
}
