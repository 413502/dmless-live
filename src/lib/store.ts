// lib/store.ts
// TRUE SINGLETON using globalThis — survives Next.js module caching across API routes
// Each serverless function shares the same Node.js process in dev; in prod each
// cold start gets a fresh store (acceptable for MVP).

import { v4 as uuidv4 } from 'uuid';

export interface MCQ {
  id: string;
  question: string;
  options: string[]; // 4 options
  correctIndex: number; // 0-3
}

export interface Job {
  id: string;
  recruiterId: string;
  title: string;
  description: string;
  mcqs: MCQ[];
  status: 'open' | 'closed';
  createdAt: string;
}

export interface CandidateSubmission {
  id: string;
  jobId: string;
  email: string;
  name: string;
  status: 'knocked_out' | 'shortlisted';
  knockoutMcqIndex?: number;
  resumeFileName?: string;
  resumeSize?: number;
  resumeMimeType?: string;
  attemptedAt: string;
  completedAt?: string;
}

export interface Recruiter {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

// ── Global singleton stores ───────────────────────────────────────────────────
// Using globalThis ensures all API routes share the same data within a process.
declare global {
  // eslint-disable-next-line no-var
  var __dmless_recruiters: Map<string, Recruiter> | undefined;
  // eslint-disable-next-line no-var
  var __dmless_jobs: Map<string, Job> | undefined;
  // eslint-disable-next-line no-var
  var __dmless_submissions: Map<string, CandidateSubmission> | undefined;
  // eslint-disable-next-line no-var
  var __dmless_attempts: Set<string> | undefined;
}

const recruiters: Map<string, Recruiter> =
  globalThis.__dmless_recruiters ?? (globalThis.__dmless_recruiters = new Map());

const jobs: Map<string, Job> =
  globalThis.__dmless_jobs ?? (globalThis.__dmless_jobs = new Map());

const submissions: Map<string, CandidateSubmission> =
  globalThis.__dmless_submissions ?? (globalThis.__dmless_submissions = new Map());

const attempts: Set<string> =
  globalThis.__dmless_attempts ?? (globalThis.__dmless_attempts = new Set());

// ── Recruiter helpers ─────────────────────────────────────────────────────────
export function createRecruiter(email: string, password: string, name: string): Recruiter {
  const normalised = email.toLowerCase().trim();
  const existing = Array.from(recruiters.values()).find(r => r.email === normalised);
  if (existing) throw new Error('An account with this email already exists');
  const r: Recruiter = {
    id: uuidv4(),
    email: normalised,
    password,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  recruiters.set(r.id, r);
  return r;
}

export function findRecruiterByEmail(email: string): Recruiter | undefined {
  const normalised = email.toLowerCase().trim();
  return Array.from(recruiters.values()).find(r => r.email === normalised);
}

export function findRecruiterById(id: string): Recruiter | undefined {
  return recruiters.get(id);
}

// ── Job helpers ───────────────────────────────────────────────────────────────
export function createJob(data: Omit<Job, 'id' | 'createdAt'>): Job {
  // Attach stable IDs to MCQs if missing
  const mcqs = data.mcqs.map(m => ({ ...m, id: m.id || uuidv4() }));
  const job: Job = { ...data, mcqs, id: uuidv4(), createdAt: new Date().toISOString() };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function getJobsByRecruiter(recruiterId: string): Job[] {
  return Array.from(jobs.values()).filter(j => j.recruiterId === recruiterId);
}

export function updateJobStatus(id: string, status: 'open' | 'closed'): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  job.status = status;
  return job;
}

// ── Submission helpers ────────────────────────────────────────────────────────
export function hasAttempted(jobId: string, email: string): boolean {
  return attempts.has(`${jobId}:${email.toLowerCase().trim()}`);
}

export function createSubmission(
  data: Omit<CandidateSubmission, 'id' | 'attemptedAt'>
): CandidateSubmission {
  const key = `${data.jobId}:${data.email.toLowerCase().trim()}`;
  if (attempts.has(key)) throw new Error('Already attempted');
  attempts.add(key);
  const sub: CandidateSubmission = {
    ...data,
    id: uuidv4(),
    attemptedAt: new Date().toISOString(),
  };
  submissions.set(sub.id, sub);
  return sub;
}

export function updateSubmission(
  id: string,
  updates: Partial<CandidateSubmission>
): CandidateSubmission | undefined {
  const sub = submissions.get(id);
  if (!sub) return undefined;
  Object.assign(sub, updates);
  return sub;
}

export function getSubmissionsByJob(jobId: string): CandidateSubmission[] {
  return Array.from(submissions.values()).filter(s => s.jobId === jobId);
}

export function getSubmissionByJobAndEmail(
  jobId: string,
  email: string
): CandidateSubmission | undefined {
  const normalised = email.toLowerCase().trim();
  return Array.from(submissions.values()).find(
    s => s.jobId === jobId && s.email.toLowerCase() === normalised
  );
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
    highestFailureMcq: highest ? highest.question : null,
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
