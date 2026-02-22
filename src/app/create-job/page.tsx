'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface MCQ {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

function emptyMCQ(): MCQ {
  return { question: '', options: ['', '', '', ''], correctIndex: 0 };
}

export default function CreateJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [mcqs, setMcqs] = useState<MCQ[]>([emptyMCQ(), emptyMCQ(), emptyMCQ(), emptyMCQ(), emptyMCQ()]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function updateMCQField(i: number, field: 'question' | 'correctIndex', value: string | number) {
    setMcqs(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  }

  function updateOption(mcqIdx: number, optIdx: number, value: string) {
    setMcqs(prev => prev.map((m, i) => {
      if (i !== mcqIdx) return m;
      const options = [...m.options] as [string, string, string, string];
      options[optIdx] = value;
      return { ...m, options };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Job title is required'); return; }
    if (!description.trim()) { setError('Job description is required'); return; }
    for (let i = 0; i < mcqs.length; i++) {
      const m = mcqs[i];
      if (!m.question.trim()) { setError(`MCQ ${i + 1}: question text is required`); return; }
      for (let j = 0; j < 4; j++) {
        if (!m.options[j].trim()) { setError(`MCQ ${i + 1}: option ${String.fromCharCode(65 + j)} is required`); return; }
      }
    }
    setLoading(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, mcqs, timeLimitMinutes, maxAttempts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create job');
      setCreated({ id: data.id, title: data.title });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    const url = `${window.location.origin}/job/${created.id}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 3000); }
    catch { prompt('Copy your hiring link:', url); }
  }

  if (created) {
    const hiringUrl = typeof window !== 'undefined' ? `${window.location.origin}/job/${created.id}` : `/job/${created.id}`;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full card text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">🎉</span></div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Hiring link created!</h1>
          <p className="text-slate-500 text-sm mb-6">Share this with candidates for <strong>{created.title}</strong></p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-xs text-slate-600 break-all mb-4 text-left">{hiringUrl}</div>
          <button onClick={copyLink} className={`btn-primary w-full mb-3 ${copied ? 'bg-green-600 hover:bg-green-700' : ''}`}>
            {copied ? '✓ Copied to clipboard!' : '🔗 Copy hiring link'}
          </button>
          <Link href="/dashboard" className="btn-secondary w-full text-center">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-xs">dm</span></div>
            <span className="font-bold text-slate-900">dmless</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Back to dashboard</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Create Hiring Link</h1>
          <p className="text-slate-500 mt-1 text-sm">Set up your job + 5 knockout MCQs. Wrong answer = instant rejection.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card space-y-5">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Job Details</h2>
            <div>
              <label className="label">Job Title *</label>
              <input className="input" placeholder="e.g. Frontend Engineer" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="label">Job Description *</label>
              <textarea className="input resize-y" rows={4} placeholder="Describe the role, responsibilities, requirements..." value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Time Limit (minutes)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={180}
                  placeholder="0 = no limit"
                  value={timeLimitMinutes}
                  onChange={e => setTimeLimitMinutes(Number(e.target.value))}
                />
                <p className="text-xs text-slate-400 mt-1">0 = unlimited time</p>
              </div>
              <div>
                <label className="label">Max Attempts</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttempts}
                  onChange={e => setMaxAttempts(Math.max(1, Number(e.target.value)))}
                />
                <p className="text-xs text-slate-400 mt-1">How many tries per candidate</p>
              </div>
            </div>
          </div>

          <div className="card space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-800">Screening MCQs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Exactly 5 required. First wrong answer = instant knockout.</p>
            </div>
            {mcqs.map((mcq, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">{i + 1}</div>
                  <span className="font-semibold text-slate-700 text-sm">Question {i + 1}</span>
                </div>
                <div>
                  <label className="label">Question text *</label>
                  <input className="input" placeholder={`Enter question ${i + 1}...`} value={mcq.question} onChange={e => updateMCQField(i, 'question', e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {mcq.options.map((opt, j) => (
                    <div key={j}>
                      <label className="label text-xs">Option {String.fromCharCode(65 + j)} *</label>
                      <input className="input text-sm" placeholder={`Option ${String.fromCharCode(65 + j)}`} value={opt} onChange={e => updateOption(i, j, e.target.value)} required />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="label">Correct answer *</label>
                  <select className="input" value={mcq.correctIndex} onChange={e => updateMCQField(i, 'correctIndex', parseInt(e.target.value))}>
                    {(['A', 'B', 'C', 'D'] as const).map((letter, j) => (
                      <option key={j} value={j}>Option {letter}{mcq.options[j] ? ` — "${mcq.options[j]}"` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠ {error}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? 'Creating...' : '🔗 Generate Hiring Link'}
          </button>
        </form>
      </main>
    </div>
  );
}
