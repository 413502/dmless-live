'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

interface MCQ {
  id?: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

interface Job {
  id: string;
  title: string;
  description: string;
  mcqs: MCQ[];
  status: 'open' | 'closed';
  timeLimitMinutes: number;
  maxAttempts: number;
}

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then(async r => {
        if (!r.ok) { router.push('/dashboard'); return; }
        const data: Job = await r.json();
        setTitle(data.title);
        setDescription(data.description);
        setStatus(data.status);
        setTimeLimitMinutes(data.timeLimitMinutes ?? 0);
        setMaxAttempts(data.maxAttempts ?? 1);
        setMcqs(data.mcqs.map(m => ({
          id: m.id,
          question: m.question,
          options: m.options as [string, string, string, string],
          correctIndex: m.correctIndex as 0 | 1 | 2 | 3,
        })));
        setLoading(false);
      })
      .catch(() => router.push('/dashboard'));
  }, [jobId, router]);

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
    setSuccess('');

    if (!title.trim()) { setError('Job title is required'); return; }
    if (!description.trim()) { setError('Job description is required'); return; }
    for (let i = 0; i < mcqs.length; i++) {
      const m = mcqs[i];
      if (!m.question.trim()) { setError(`MCQ ${i + 1}: question is required`); return; }
      for (let j = 0; j < 4; j++) {
        if (!m.options[j]?.trim()) { setError(`MCQ ${i + 1}: option ${String.fromCharCode(65 + j)} is required`); return; }
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, mcqs, status, timeLimitMinutes, maxAttempts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSuccess('Job updated successfully!');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-400 text-sm animate-pulse">Loading job...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">dm</span>
            </div>
            <span className="font-bold text-slate-900">dmless</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Back to dashboard</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Edit Hiring Link</h1>
          <p className="text-slate-500 mt-1 text-sm">Changes take effect immediately for new candidates.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Details */}
          <div className="card space-y-5">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Job Details</h2>
            <div>
              <label className="label">Job Title *</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="label">Job Description *</label>
              <textarea className="input resize-y" rows={4} value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select className="input" value={status} onChange={e => setStatus(e.target.value as 'open' | 'closed')}>
                  <option value="open">Open — accepting applications</option>
                  <option value="closed">Closed — no new applications</option>
                </select>
              </div>
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
            </div>
            <div className="max-w-xs">
              <label className="label">Max Attempts per Candidate</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={e => setMaxAttempts(Math.max(1, Number(e.target.value)))}
              />
              <p className="text-xs text-slate-400 mt-1">1 = one shot only (recommended)</p>
            </div>
          </div>

          {/* MCQs */}
          <div className="card space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-800">Screening MCQs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Exactly 5 questions. Editing these does NOT affect existing submissions.</p>
            </div>

            {mcqs.map((mcq, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">{i + 1}</div>
                  <span className="font-semibold text-slate-700 text-sm">Question {i + 1}</span>
                </div>
                <div>
                  <label className="label">Question text *</label>
                  <input className="input" value={mcq.question} onChange={e => updateMCQField(i, 'question', e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {mcq.options.map((opt, j) => (
                    <div key={j}>
                      <label className="label text-xs">Option {String.fromCharCode(65 + j)} *</label>
                      <input className="input text-sm" value={opt} onChange={e => updateOption(i, j, e.target.value)} required />
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
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✓ {success}</div>}

          <div className="flex gap-3">
            <Link href="/dashboard" className="btn-secondary flex-1 text-center">Cancel</Link>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
