'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface MCQRate {
  question: string;
  failureCount: number;
  totalAttempts: number;
  rate: number;
}

interface Analytics {
  totalApplied: number;
  knockedOut: number;
  shortlisted: number;
  mcqFailureRates: MCQRate[];
  highestFailureMcq: string | null;
}

interface Job {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  createdAt: string;
  timeLimitMinutes: number;
  maxAttempts: number;
  analytics: Analytics;
}

interface Recruiter { id: string; name: string; email: string; }

export default function Dashboard() {
  const router = useRouter();
  const [recruiter, setRecruiter] = useState<Recruiter | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function loadData() {
    try {
      const [meRes, jobsRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/jobs')]);
      if (!meRes.ok) { setAuthError(true); setLoading(false); return; }
      setRecruiter(await meRes.json());
      if (jobsRes.ok) setJobs(await jobsRes.json());
    } catch { setAuthError(true); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (authError) router.push('/login'); }, [authError, router]);

  const totalApplied = jobs.reduce((s, j) => s + j.analytics.totalApplied, 0);
  const totalKnocked = jobs.reduce((s, j) => s + j.analytics.knockedOut, 0);
  const totalShortlisted = jobs.reduce((s, j) => s + j.analytics.shortlisted, 0);
  const conversionRate = totalApplied > 0 ? Math.round((totalShortlisted / totalApplied) * 100) : 0;

  async function copyLink(jobId: string) {
    const url = `${window.location.origin}/job/${jobId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(jobId);
      setTimeout(() => setCopied(null), 2500);
    } catch { prompt('Copy this link:', url); }
  }

  async function toggleStatus(job: Job) {
    if (toggling) return;
    setToggling(job.id);
    const newStatus = job.status === 'open' ? 'closed' : 'open';
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
    } finally { setToggling(null); }
  }

  async function logout() {
    await fetch('/api/auth/me', { method: 'DELETE' });
    router.push('/');
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-400 text-sm animate-pulse">Loading dashboard...</div>
    </div>
  );
  if (authError) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">dm</span>
            </div>
            <span className="font-bold text-lg text-slate-900">dmless</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">{recruiter?.name}</span>
            <Link href="/create-job" className="btn-primary text-sm py-2 px-4">+ Create Hiring Link</Link>
            <button onClick={logout} className="text-sm text-slate-400 hover:text-red-600 transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Recruiter Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">Live hiring funnel analytics — data persists across restarts</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Jobs', value: jobs.filter(j => j.status === 'open').length, icon: '💼', bg: 'bg-blue-50', text: 'text-blue-700' },
            { label: 'Total Applied', value: totalApplied, icon: '👥', bg: 'bg-slate-50', text: 'text-slate-700' },
            { label: 'Knocked Out', value: totalKnocked, icon: '❌', bg: 'bg-red-50', text: 'text-red-600' },
            { label: 'Shortlisted', value: totalShortlisted, icon: '✅', bg: 'bg-green-50', text: 'text-green-700' },
          ].map(stat => (
            <div key={stat.label} className="card flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center text-xl shrink-0`}>{stat.icon}</div>
              <div>
                <div className={`text-2xl font-bold ${stat.text}`}>{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Funnel */}
        {totalApplied > 0 && (
          <div className="card mb-8">
            <h2 className="font-bold text-slate-800 mb-1 text-sm">Hiring Funnel</h2>
            <p className="text-xs text-slate-400 mb-5">Conversion: <strong>{conversionRate}%</strong> shortlisted</p>
            <div className="flex items-end gap-3 h-24">
              {[
                { label: 'Applied', count: totalApplied, pct: 100, color: 'bg-blue-500' },
                { label: 'Knocked Out', count: totalKnocked, pct: totalApplied > 0 ? (totalKnocked / totalApplied) * 100 : 0, color: 'bg-red-400' },
                { label: 'Shortlisted', count: totalShortlisted, pct: totalApplied > 0 ? (totalShortlisted / totalApplied) * 100 : 0, color: 'bg-green-500' },
              ].map(bar => (
                <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-slate-700">{bar.count}</span>
                  <div className="w-full flex items-end h-16 bg-slate-50 rounded-lg overflow-hidden">
                    <div className={`w-full ${bar.color} rounded-lg transition-all duration-700`} style={{ height: `${Math.max(6, bar.pct)}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-500 text-center leading-tight">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Jobs list */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-slate-900">Your Hiring Links</h2>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔗</div>
              <p className="text-slate-500 mb-4">No hiring links yet.</p>
              <Link href="/create-job" className="btn-primary text-sm">Create your first hiring link</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => {
                const a = job.analytics;
                const jobConversion = a.totalApplied > 0 ? Math.round((a.shortlisted / a.totalApplied) * 100) : 0;
                return (
                  <div key={job.id} className="border border-slate-100 rounded-xl p-5 hover:border-blue-100 hover:bg-blue-50/10 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-slate-900 truncate">{job.title}</h3>
                          <span className={job.status === 'open' ? 'badge-open' : 'badge-closed'}>
                            <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'open' ? 'bg-green-500' : 'bg-red-500'}`} />
                            {job.status}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-slate-400 flex-wrap">
                          <span>Created {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {job.timeLimitMinutes > 0 && <span>⏱ {job.timeLimitMinutes}min limit</span>}
                          <span>🔁 Max {job.maxAttempts} attempt{job.maxAttempts > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <button
                          onClick={() => copyLink(job.id)}
                          className={`text-xs px-3 py-2 rounded-lg border font-medium transition-all whitespace-nowrap ${
                            copied === job.id ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700'
                          }`}
                        >
                          {copied === job.id ? '✓ Copied!' : '🔗 Copy link'}
                        </button>
                        <Link
                          href={`/dashboard/job/${job.id}/candidates`}
                          className="text-xs px-3 py-2 rounded-lg border font-medium bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700 whitespace-nowrap"
                        >
                          👥 Candidates{job.analytics.shortlisted > 0 ? ` (${job.analytics.shortlisted})` : ''}
                        </Link>
                        <Link
                          href={`/edit-job/${job.id}`}
                          className="text-xs px-3 py-2 rounded-lg border font-medium bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 whitespace-nowrap"
                        >
                          ✏ Edit
                        </Link>
                        <button
                          onClick={() => toggleStatus(job)}
                          disabled={toggling === job.id}
                          className={`text-xs px-3 py-2 rounded-lg border font-medium transition-all whitespace-nowrap ${
                            job.status === 'open'
                              ? 'bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-600 hover:bg-green-50'
                          } disabled:opacity-50`}
                        >
                          {toggling === job.id ? '...' : job.status === 'open' ? 'Close' : 'Reopen'}
                        </button>
                      </div>
                    </div>

                    {/* Analytics row */}
                    <div className="flex flex-wrap gap-4 text-sm mb-3">
                      <span className="text-slate-500">Applied: <strong className="text-slate-800">{a.totalApplied}</strong></span>
                      <span className="text-slate-500">Knocked out: <strong className="text-red-600">{a.knockedOut}</strong></span>
                      <span className="text-slate-500">Shortlisted: <strong className="text-green-600">{a.shortlisted}</strong></span>
                      {a.totalApplied > 0 && <span className="text-slate-500">Pass rate: <strong className="text-blue-600">{jobConversion}%</strong></span>}
                    </div>

                    {/* MCQ failure bars */}
                    {a.mcqFailureRates.length > 0 && a.totalApplied > 0 && (
                      <div>
                        <p className="text-[11px] text-slate-400 mb-2 uppercase tracking-wide font-medium">
                          MCQ failure rates
                          {a.highestFailureMcq && (
                            <span className="ml-2 text-orange-500 normal-case">
                              ⚠ Hardest: &ldquo;{a.highestFailureMcq.slice(0, 40)}{a.highestFailureMcq.length > 40 ? '…' : ''}&rdquo;
                            </span>
                          )}
                        </p>
                        <div className="flex gap-2 items-end">
                          {a.mcqFailureRates.map((mcq, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1"
                              title={`Q${i + 1}: ${mcq.question}\n${mcq.failureCount}/${mcq.totalAttempts} failed (${mcq.rate}%)`}>
                              <span className="text-[10px] font-bold text-slate-500">{mcq.rate > 0 ? `${mcq.rate}%` : '—'}</span>
                              <div className="w-full h-8 bg-slate-100 rounded relative overflow-hidden">
                                <div
                                  className={`absolute bottom-0 w-full rounded transition-all duration-500 ${mcq.rate > 60 ? 'bg-red-400' : mcq.rate > 30 ? 'bg-orange-400' : 'bg-green-400'}`}
                                  style={{ height: `${Math.max(mcq.rate, mcq.rate > 0 ? 15 : 0)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400">Q{i + 1}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
