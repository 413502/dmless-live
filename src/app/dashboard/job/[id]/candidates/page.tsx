'use client';

/**
 * /dashboard/job/[id]/candidates
 *
 * Recruiter-only page. Shows all candidates who passed MCQs for this job.
 * Recruiters can mark each candidate as "Hired" or "Rejected".
 *
 * NEW FILE — does not touch any existing page or flow.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type CandidateStatus = 'shortlisted' | 'hired' | 'rejected_after_screening';

interface Candidate {
  id: string;
  name: string;
  email: string;
  status: CandidateStatus;
  resumeFileName: string | null;
  resumeSize: number | null;
  resumeMimeType: string | null;
  resumeUrl: string | null;
  attemptedAt: string;
  completedAt: string | null;
}

interface Job {
  id: string;
  title: string;
  status: 'open' | 'closed';
}

const STATUS_STYLES: Record<CandidateStatus, string> = {
  shortlisted: 'bg-blue-50 text-blue-700 border-blue-200',
  hired: 'bg-green-50 text-green-700 border-green-200',
  rejected_after_screening: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_LABELS: Record<CandidateStatus, string> = {
  shortlisted: '✦ Shortlisted',
  hired: '✓ Hired',
  rejected_after_screening: '✕ Rejected',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tracks which candidate ID is currently being actioned (shows spinner)
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/candidates`)
      .then(async res => {
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to load candidates');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setJob(data.job);
        setCandidates(data.candidates);
        setLoading(false);
      })
      .catch(() => {
        setError('Network error. Please refresh.');
        setLoading(false);
      });
  }, [jobId, router]);

  async function setDecision(candidateId: string, decision: 'hired' | 'rejected_after_screening') {
    if (actioning) return;
    setActioning(candidateId);

    try {
      const res = await fetch(`/api/candidates/${candidateId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
        return;
      }

      // Optimistic update — reflect change immediately in UI
      setCandidates(prev =>
        prev.map(c =>
          c.id === candidateId ? { ...c, status: decision } : c
        )
      );
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setActioning(null);
    }
  }

  async function undoDecision(candidateId: string) {
    if (actioning) return;
    setActioning(candidateId);

    try {
      const res = await fetch(`/api/candidates/${candidateId}/undo`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to undo decision');
        return;
      }

      // Optimistic update — revert to shortlisted immediately
      setCandidates(prev =>
        prev.map(c =>
          c.id === candidateId ? { ...c, status: 'shortlisted' } : c
        )
      );
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setActioning(null);
    }
  }


  const counts = {
    shortlisted: candidates.filter(c => c.status === 'shortlisted').length,
    hired: candidates.filter(c => c.status === 'hired').length,
    rejected: candidates.filter(c => c.status === 'rejected_after_screening').length,
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400 text-sm animate-pulse">Loading candidates...</p>
    </div>
  );

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <Link href="/dashboard" className="btn-secondary text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav — same structure as dashboard */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">dm</span>
              </div>
              <span className="font-bold text-lg text-slate-900">dmless</span>
            </Link>
            <span className="text-slate-300 text-lg select-none">/</span>
            <span className="text-slate-500 text-sm truncate max-w-[200px]">{job?.title}</span>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Shortlisted Candidates</h1>
          <p className="text-slate-500 mt-1 text-sm">
            For: <strong className="text-slate-700">{job?.title}</strong>
            {job?.status === 'closed' && (
              <span className="ml-2 text-xs text-red-500 font-medium">(Job closed)</span>
            )}
          </p>
        </div>

        {/* Summary counts */}
        {candidates.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card flex items-center gap-3 py-4">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-lg shrink-0">📋</div>
              <div>
                <div className="text-xl font-bold text-blue-700">{counts.shortlisted}</div>
                <div className="text-xs text-slate-500">Pending review</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 py-4">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-lg shrink-0">🎉</div>
              <div>
                <div className="text-xl font-bold text-green-700">{counts.hired}</div>
                <div className="text-xs text-slate-500">Hired</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 py-4">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-lg shrink-0">✕</div>
              <div>
                <div className="text-xl font-bold text-red-600">{counts.rejected}</div>
                <div className="text-xs text-slate-500">Rejected</div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {candidates.length === 0 ? (
          <div className="card text-center py-20">
            <div className="text-5xl mb-4">🕐</div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">No candidates yet</h2>
            <p className="text-slate-500 text-sm mb-6">
              Candidates who pass all MCQs and upload their resume will appear here.
            </p>
            <Link href="/dashboard" className="btn-secondary text-sm">← Back to Dashboard</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map(candidate => (
              <div
                key={candidate.id}
                className="card p-5"
              >
                <div className="flex items-start gap-4 flex-wrap">

                  {/* Left: candidate info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                      {/* Status badge */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[candidate.status]}`}>
                        {STATUS_LABELS[candidate.status]}
                      </span>
                    </div>

                    {/* Email */}
                    <a
                      href={`mailto:${candidate.email}`}
                      className="text-sm text-blue-600 hover:underline block mb-2"
                    >
                      {candidate.email}
                    </a>

                    {/* Resume info */}
                    {candidate.resumeFileName ? (
                      <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600">
                        <span className="text-base">📄</span>
                        <span className="font-medium truncate max-w-[200px]">{candidate.resumeFileName}</span>
                        {candidate.resumeSize && (
                          <span className="text-slate-400 shrink-0">{formatFileSize(candidate.resumeSize)}</span>
                        )}
                        {candidate.resumeUrl ? (
                          <>
                            <span className="text-slate-300">·</span>
                            <a
                              href={candidate.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium shrink-0"
                            >
                              View
                            </a>
                            <span className="text-slate-300">·</span>
                            <a
                              href={candidate.resumeUrl}
                              download={candidate.resumeFileName}
                              className="text-blue-600 hover:underline font-medium shrink-0"
                            >
                              Download
                            </a>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-400 italic">Contact candidate for file</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        <span>⚠</span>
                        <span>Resume not yet uploaded</span>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-4 mt-2 text-[11px] text-slate-400">
                      <span>Applied {formatDate(candidate.attemptedAt)}</span>
                      {candidate.completedAt && (
                        <span>· Completed {formatDate(candidate.completedAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-center">
                    {candidate.status === 'shortlisted' ? (
                      // Show both buttons only when pending review
                      <>
                        <button
                          onClick={() => setDecision(candidate.id, 'hired')}
                          disabled={actioning === candidate.id}
                          className="text-sm px-4 py-2 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {actioning === candidate.id ? '...' : '✓ Hire'}
                        </button>
                        <button
                          onClick={() => setDecision(candidate.id, 'rejected_after_screening')}
                          disabled={actioning === candidate.id}
                          className="text-sm px-4 py-2 rounded-lg font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {actioning === candidate.id ? '...' : '✕ Reject'}
                        </button>
                      </>
                    ) : (
                      // Already decided — show undo option (immediate, no popup)
                      <button
                        onClick={() => undoDecision(candidate.id)}
                        disabled={actioning === candidate.id}
                        className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {actioning === candidate.id ? '...' : '↩ Undo'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
