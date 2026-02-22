'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">dm</span>
          </div>
          <span className="font-bold text-xl text-slate-900">dmless</span>
        </div>
        <div className="flex items-center gap-4">
          {/* B) Reduced contrast on Login so CTA is dominant */}
          <Link href="/login" className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">
            Recruiter Login
          </Link>
          <Link href="/signup" className="btn-primary py-2 px-5 text-sm">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-8 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 rounded-full px-4 py-2 text-sm font-semibold mb-8 border border-blue-200">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          Hiring automation for modern teams
        </div>

        {/* A) Clearer, punchier headline and subtext */}
        <h1 className="font-display text-6xl md:text-7xl text-slate-900 leading-tight mb-6">
          Hire faster with<br />
          <span className="text-blue-700">self-screening MCQs.</span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed">
          Candidates qualify themselves. Only the best reach your inbox.
        </p>

        {/* B) CTA emphasis — primary is visually dominant, secondary is muted */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup" className="btn-primary text-base py-4 px-10 inline-flex items-center gap-2 shadow-lg shadow-blue-200">
            Create Hiring Link
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link href="/login" className="text-slate-500 hover:text-slate-700 text-base py-4 px-8 inline-flex items-center gap-2 transition-colors">
            Recruiter Login →
          </Link>
        </div>

        {/* C) Feature pills — grouped by theme */}
        <div className="mt-16 space-y-3">
          {/* Screening */}
          <div className="flex flex-wrap gap-3 justify-center">
            {['Knockout MCQ logic', 'One-time attempt'].map(f => (
              <span key={f} className="bg-white border border-blue-100 text-blue-700 text-sm font-medium px-4 py-2 rounded-full shadow-sm">
                ✓ {f}
              </span>
            ))}
          </div>
          {/* Recruiter value */}
          <div className="flex flex-wrap gap-3 justify-center">
            {['Instant shortlisting', 'Analytics dashboard'].map(f => (
              <span key={f} className="bg-white border border-slate-200 text-slate-600 text-sm font-medium px-4 py-2 rounded-full shadow-sm">
                ✓ {f}
              </span>
            ))}
          </div>
          {/* Setup */}
          <div className="flex flex-wrap gap-3 justify-center">
            <span className="bg-white border border-slate-200 text-slate-400 text-sm font-medium px-4 py-2 rounded-full shadow-sm">
              No setup required
            </span>
          </div>
        </div>

        {/* D) Stats cards — improved copy */}
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-20">
          <div className="card text-center">
            <div className="font-display text-3xl text-blue-700 mb-1">100%</div>
            <div className="text-sm font-semibold text-slate-700">Automated Screening</div>
            <div className="text-xs text-slate-400 mt-0.5">No manual filtering</div>
          </div>
          <div className="card text-center">
            <div className="font-display text-3xl text-blue-700 mb-1">0 DMs</div>
            <div className="text-sm font-semibold text-slate-700">No Manual Messages</div>
            <div className="text-xs text-slate-400 mt-0.5">Zero recruiter follow-ups</div>
          </div>
          <div className="card text-center">
            <div className="font-display text-3xl text-blue-700 mb-1">5 MCQs</div>
            <div className="text-sm font-semibold text-slate-700">Just 5 Questions</div>
            <div className="text-xs text-slate-400 mt-0.5">To qualify top candidates</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} dmless — Hiring automation MVP
      </footer>
    </div>
  );
}
