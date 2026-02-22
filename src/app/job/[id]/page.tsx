'use client';

/**
 * Candidate page — /job/[id]
 *
 * KEY FIXES IN THIS VERSION:
 * 1. Shell moved OUTSIDE component to prevent remount on every render (fixes input focus loss)
 * 2. Per-question knockout: each "Next" click evaluates the answer immediately via API
 * 3. Next button always works — no stale state, no re-render issues
 * 4. File input is a stable uncontrolled input; file name displayed from React state
 */

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface MCQ {
  id: string;
  question: string;
  options: string[];
}

interface Job {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  mcqs: MCQ[];
  timeLimitMinutes: number;
  maxAttempts: number;
}

type Stage =
  | 'loading'
  | 'error'
  | 'closed'
  | 'info'
  | 'test'
  | 'submitting'
  | 'knocked_out'
  | 'upload'
  | 'done'
  | 'limit_reached';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Shell is defined OUTSIDE the component so it never remounts ───────────────
// This is the root cause fix for input focus loss: when Shell was defined inside
// the component body, React treated it as a new component type on every render,
// causing full unmount → remount → focus loss on every keystroke.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">dm</span>
            </div>
            <span className="font-bold text-lg text-slate-900">dmless</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CandidatePage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [limitMsg, setLimitMsg] = useState('');

  // Candidate info — stable state, never reinitialised
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Test state
  const [currentMcq, setCurrentMcq] = useState(0);
  // answers[i] = option index selected for question i, null = not yet answered
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const testStartedAt = useRef<number>(0);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result state
  const [knockoutMsg, setKnockoutMsg] = useState('');
  const [failedAt, setFailedAt] = useState<number | null>(null);
  const [submissionId, setSubmissionId] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload state
  const [fileName, setFileName] = useState('');
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  // Track if a per-question submission is in-flight (prevents double clicks)
  const evaluating = useRef(false);

  // ── Load job ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/candidates/job/${jobId}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) { setErrorMsg(data.error || 'Failed to load job'); setStage('error'); return; }
        setJob(data);
        setStage(data.status === 'closed' ? 'closed' : 'info');
      })
      .catch(() => { setErrorMsg('Network error. Please refresh.'); setStage('error'); });
  }, [jobId]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Timer ───────────────────────────────────────────────────────────────────
  function startTimerFn(limitSeconds: number) {
    if (limitSeconds <= 0) return;
    setSecondsLeft(limitSeconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Auto-submit current answers on timeout
          setAnswers(curr => { handleTimeExpiry(curr); return curr; });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleTimeExpiry(currentAnswers: (number | null)[]) {
    const finalAnswers = currentAnswers.map(a => (a === null ? -1 : a));
    await submitAllAnswers(finalAnswers);
  }

  // ── Check attempt limit before starting ─────────────────────────────────────
  async function checkAndStart(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !job) return;

    try {
      const res = await fetch(
        `/api/candidates/check?jobId=${encodeURIComponent(jobId)}&email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (!data.canAttempt) {
        setLimitMsg(
          data.maxAttempts === 1
            ? 'You have already submitted an application for this role. Each candidate may only attempt once.'
            : `You have used all ${data.maxAttempts} allowed attempts for this role.`
        );
        setStage('limit_reached');
        return;
      }
    } catch { /* proceed if check fails */ }

    const initAnswers = new Array(job.mcqs.length).fill(null);
    setCurrentMcq(0);
    setAnswers(initAnswers);
    testStartedAt.current = Date.now();
    setStage('test');
    if (job.timeLimitMinutes > 0) startTimerFn(job.timeLimitMinutes * 60);
  }

  // ── Select an answer for the current question ────────────────────────────────
  function selectAnswer(optionIdx: number) {
    setAnswers(prev => {
      const next = [...prev];
      next[currentMcq] = optionIdx;
      return next;
    });
  }

  // ── CORE FIX: Evaluate answer immediately when Next/Submit is clicked ────────
  //
  // Instead of waiting until all 5 answers are collected, we now hit the server
  // after EVERY question. The server checks if this specific answer is correct.
  // If wrong → save as knocked_out, return knockout result immediately.
  // If right and not the last question → move to next question.
  // If right and last question → move to resume upload.
  //
  // This guarantees the candidate cannot continue past a wrong answer.
  async function handleNextOrSubmit() {
    if (!job || evaluating.current) return;

    const selectedAnswer = answers[currentMcq];
    if (selectedAnswer === null) return; // shouldn't be possible (button disabled)

    const isLast = currentMcq === job.mcqs.length - 1;

    if (!isLast) {
      // ── Not the last question: evaluate this single answer immediately ────
      evaluating.current = true;
      setStage('submitting');

      try {
        // Build answers array: current answer + -1 placeholders for remaining
        // The server evaluates sequentially and stops at first wrong answer.
        const partialAnswers = answers.map((a, i) => {
          if (i < currentMcq) return a ?? -1;       // already answered
          if (i === currentMcq) return selectedAnswer; // current answer
          return -2;                                  // not yet reached (sentinel)
        });

        const res = await fetch('/api/candidates/submit-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            name,
            email,
            questionIndex: currentMcq,
            answer: selectedAnswer,
          }),
        });
        const data = await res.json();

        evaluating.current = false;

        if (data.alreadyAttempted) {
          setLimitMsg(data.error || 'Attempt limit reached.');
          setStage('limit_reached');
          return;
        }

        if (data.correct === false) {
          // Wrong answer — immediate knockout
          setKnockoutMsg(data.message || `Thank you for applying. Unfortunately, your answer to Question ${currentMcq + 1} was incorrect. We wish you the best in your search!`);
          setFailedAt(currentMcq + 1);
          // Save the knockout to DB
          await saveKnockout(currentMcq);
          setStage('knocked_out');
          return;
        }

        // Correct — advance to next question
        setStage('test');
        setCurrentMcq(prev => prev + 1);

      } catch {
        evaluating.current = false;
        setErrorMsg('Network error. Please try again.');
        setStage('error');
      }

    } else {
      // ── Last question: submit all answers ─────────────────────────────────
      const finalAnswers = answers.map((a, i) => i === currentMcq ? selectedAnswer : (a ?? -1));
      await submitAllAnswers(finalAnswers);
    }
  }

  // Save knockout immediately to the DB (so dashboard updates right away)
  async function saveKnockout(failedIndex: number) {
    try {
      const partialAnswers = answers.map((a, i) => {
        if (i < failedIndex) return a ?? -1;
        if (i === failedIndex) return answers[failedIndex] ?? -1;
        return -1;
      });
      const timeTakenSeconds = Math.round((Date.now() - testStartedAt.current) / 1000);
      await fetch('/api/candidates/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId, name, email,
          answers: partialAnswers,
          timeTakenSeconds,
          forceKnockoutAt: failedIndex,
        }),
      });
    } catch { /* best-effort */ }
  }

  // Full submission (all questions answered or timer expired)
  async function submitAllAnswers(finalAnswers: number[]) {
    if (!job) return;
    setStage('submitting');
    const timeTakenSeconds = Math.round((Date.now() - testStartedAt.current) / 1000);

    try {
      const res = await fetch('/api/candidates/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, name, email, answers: finalAnswers, timeTakenSeconds }),
      });
      const data = await res.json();

      if (data.alreadyAttempted) { setLimitMsg(data.error || 'Attempt limit reached.'); setStage('limit_reached'); return; }
      if (!res.ok) { setErrorMsg(data.error || 'Submission failed.'); setStage('error'); return; }

      setSubmissionId(data.submissionId);
      if (data.result === 'knocked_out') {
        setKnockoutMsg(data.message);
        setFailedAt(data.failedAt ?? null);
        setStage('knocked_out');
      } else {
        setSuccessMsg(data.message);
        setStage('upload');
      }
    } catch {
      setErrorMsg('Network error during submission. Please try again.');
      setStage('error');
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!fileRef) return;
    setUploadError('');
    setUploading(true);
    const fd = new FormData();
    fd.append('resume', fileRef);
    fd.append('submissionId', submissionId);
    fd.append('jobId', jobId);
    fd.append('email', email);
    try {
      const res = await fetch('/api/candidates/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || 'Upload failed'); setUploading(false); return; }
      setStage('done');
    } catch {
      setUploadError('Network error. Please try again.');
      setUploading(false);
    }
  }

  // ── Render stages ───────────────────────────────────────────────────────────

  if (stage === 'loading') return (
    <Shell>
      <div className="card text-center py-16 text-slate-400">
        <div className="text-3xl mb-3 animate-pulse">⏳</div>
        Loading...
      </div>
    </Shell>
  );

  if (stage === 'error') return (
    <Shell>
      <div className="card text-center py-12">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-red-600 text-sm">{errorMsg}</p>
      </div>
    </Shell>
  );

  if (stage === 'closed') return (
    <Shell>
      <div className="card text-center py-12">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{job?.title}</h1>
        <span className="badge-closed inline-flex mb-4">Closed</span>
        <p className="text-slate-500 leading-relaxed mt-3">
          This position is no longer accepting applications.<br />Thank you for your interest!
        </p>
      </div>
    </Shell>
  );

  if (stage === 'limit_reached') return (
    <Shell>
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">🚫</div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">No More Attempts</h2>
        <p className="text-slate-500 text-sm leading-relaxed">{limitMsg || 'You have reached the attempt limit for this role.'}</p>
      </div>
    </Shell>
  );

  if (stage === 'info' && job) return (
    <Shell>
      <div className="card">
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
            <span className="badge-open">Open</span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">{job.description}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800 text-sm font-semibold mb-2">⚡ How this works</p>
          <ul className="text-amber-700 text-sm space-y-1">
            <li>• Answer {job.mcqs.length} screening questions</li>
            <li>• <strong>One wrong answer = immediate rejection</strong></li>
            <li>• Pass all → upload your resume</li>
            {job.timeLimitMinutes > 0 && (
              <li>• ⏱ Time limit: <strong>{job.timeLimitMinutes} minutes</strong></li>
            )}
            {job.maxAttempts > 1
              ? <li>• You have <strong>{job.maxAttempts} attempts</strong> allowed</li>
              : <li>• <strong>One attempt only</strong> — no retries</li>}
          </ul>
        </div>

        {/*
          Input fix: Each input has a stable id, htmlFor label, and is a controlled
          component tied to top-level state. Because Shell is now defined outside
          this component, nothing remounts on typing — focus is never lost.
        */}
        <form onSubmit={checkAndStart} className="space-y-4">
          <div>
            <label htmlFor="cand-name" className="label">Full name *</label>
            <input
              id="cand-name"
              className="input"
              placeholder="Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label htmlFor="cand-email" className="label">Email address *</label>
            <input
              id="cand-email"
              className="input"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full py-4 text-base">
            Start Screening Test →
          </button>
          <p className="text-center text-xs text-slate-400">
            Make sure you&apos;re ready — the timer starts immediately.
          </p>
        </form>
      </div>
    </Shell>
  );

  if ((stage === 'test' || stage === 'submitting') && job) {
    const mcq = job.mcqs[currentMcq];
    const progress = (currentMcq / job.mcqs.length) * 100;
    const selectedForCurrent = answers[currentMcq];
    const answeredCount = answers.filter(a => a !== null).length;
    const isLast = currentMcq === job.mcqs.length - 1;
    const timerWarning = secondsLeft > 0 && secondsLeft <= 60;
    const timerDanger = secondsLeft > 0 && secondsLeft <= 30;
    const isSubmitting = stage === 'submitting';

    return (
      <Shell>
        <div className="card">
          {/* Header: progress + timer */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">
              Q{currentMcq + 1} of {job.mcqs.length}&nbsp;&nbsp;·&nbsp;&nbsp;{answeredCount} answered
            </span>
            {job.timeLimitMinutes > 0 && secondsLeft > 0 && (
              <span className={`text-xs font-bold tabular-nums px-2 py-1 rounded-lg ${
                timerDanger ? 'bg-red-100 text-red-600 animate-pulse' :
                timerWarning ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                ⏱ {formatTime(secondsLeft)}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Question */}
          <h2 className="text-base font-bold text-slate-900 mb-5 leading-snug">
            {mcq.question}
          </h2>

          {/* Options */}
          <div className="space-y-2.5 mb-5">
            {mcq.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => !isSubmitting && selectAnswer(i)}
                disabled={isSubmitting}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium text-sm transition-all ${
                  selectedForCurrent === i
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/30'
                } disabled:cursor-not-allowed`}
              >
                <span className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-bold mr-3 shrink-0 align-middle ${
                  selectedForCurrent === i
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 text-slate-500'
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentMcq(p => Math.max(0, p - 1))}
              disabled={currentMcq === 0 || isSubmitting}
              className="btn-secondary px-4 py-3 text-sm disabled:opacity-40"
            >
              ← Prev
            </button>

            {/* Next / Submit — triggers per-question evaluation */}
            <button
              onClick={handleNextOrSubmit}
              disabled={selectedForCurrent === null || isSubmitting}
              className="btn-primary flex-1 py-3 text-sm disabled:opacity-50"
            >
              {isSubmitting
                ? 'Checking...'
                : isLast
                  ? 'Submit All ✓'
                  : 'Next →'}
            </button>
          </div>

          {/* Dot question navigator */}
          <div className="flex gap-1.5 mt-4 justify-center flex-wrap">
            {answers.map((ans, i) => (
              <button
                key={i}
                onClick={() => !isSubmitting && setCurrentMcq(i)}
                disabled={isSubmitting}
                title={`Q${i + 1}`}
                className={`w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${
                  i === currentMcq
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : ans !== null
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Click a number to jump to that question
          </p>
        </div>
      </Shell>
    );
  }

  if (stage === 'knocked_out') return (
    <Shell>
      <div className="card text-center py-10">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">You Are Out of the Screening</h2>
        {failedAt && (
          <p className="text-xs text-slate-400 mb-4 uppercase tracking-wide font-medium">
            Incorrect answer on Question {failedAt}
          </p>
        )}
        <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
          {knockoutMsg || 'Thank you for your time. Unfortunately your answer was incorrect. Better luck next time!'}
        </p>
      </div>
    </Shell>
  );

  if (stage === 'upload') return (
    <Shell>
      <div className="card">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">You Passed!</h2>
          <p className="text-slate-500 text-sm">{successMsg}</p>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="label">Upload your resume *</label>
            {/*
              File input fix:
              - Input is always rendered (not conditionally mounted)
              - onChange stores File object in fileRef state AND captures name in fileName state
              - fileName drives the display so the name always appears after selection
              - Using a regular <div> wrapper (not a <label>) to avoid nested interactive elements
            */}
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors relative ${
                fileName ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
              }`}
              onClick={() => document.getElementById('resume-file-input')?.click()}
            >
              <input
                type="file"
                id="resume-file-input"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  setFileRef(f);
                  setFileName(f ? f.name : '');
                  setUploadError('');
                }}
              />
              {fileName ? (
                <>
                  <span className="text-3xl mb-2">📄</span>
                  <span className="text-green-700 font-semibold text-sm">{fileName}</span>
                  <span className="text-green-500 text-xs mt-1">
                    {fileRef ? `${(fileRef.size / 1024).toFixed(0)} KB` : ''} — click to change
                  </span>
                </>
              ) : (
                <>
                  <span className="text-3xl mb-2">📎</span>
                  <span className="text-slate-600 text-sm font-medium">Click to select resume</span>
                  <span className="text-slate-400 text-xs mt-1">PDF, DOC, or DOCX — max 5 MB</span>
                </>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {uploadError}
            </div>
          )}

          <button
            type="submit"
            disabled={!fileRef || uploading}
            className="btn-primary w-full py-3.5 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Submit Application →'}
          </button>
        </form>
      </div>
    </Shell>
  );

  if (stage === 'done') return (
    <Shell>
      <div className="card text-center py-12">
        <div className="text-5xl mb-4">🚀</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Application Complete!</h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
          Your resume has been received. The recruiter will review your application and reach out if you&apos;re a good fit. Good luck!
        </p>
      </div>
    </Shell>
  );

  return null;
}
