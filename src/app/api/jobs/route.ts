import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createJob, getJobsByRecruiter, getJobAnalytics } from '@/lib/db';

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const jobs = getJobsByRecruiter(session.recruiterId);
  const enriched = jobs
    .map(j => ({ ...j, analytics: getJobAnalytics(j.id) }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, description, mcqs, timeLimitMinutes = 0, maxAttempts = 1 } = body ?? {};

    if (!title?.trim()) return NextResponse.json({ error: 'Job title is required' }, { status: 400 });
    if (!description?.trim()) return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    if (!Array.isArray(mcqs) || mcqs.length !== 5) {
      return NextResponse.json({ error: 'Exactly 5 MCQs are required' }, { status: 400 });
    }
    for (let i = 0; i < mcqs.length; i++) {
      const m = mcqs[i];
      if (!m.question?.trim()) return NextResponse.json({ error: `MCQ ${i + 1}: question required` }, { status: 400 });
      if (!Array.isArray(m.options) || m.options.length !== 4 || m.options.some((o: string) => !o?.trim())) {
        return NextResponse.json({ error: `MCQ ${i + 1}: 4 non-empty options required` }, { status: 400 });
      }
      if (typeof m.correctIndex !== 'number' || m.correctIndex < 0 || m.correctIndex > 3) {
        return NextResponse.json({ error: `MCQ ${i + 1}: correctIndex must be 0–3` }, { status: 400 });
      }
    }

    const job = createJob({
      recruiterId: session.recruiterId,
      title: title.trim(),
      description: description.trim(),
      mcqs,
      status: 'open',
      timeLimitMinutes: Number(timeLimitMinutes) || 0,
      maxAttempts: Math.max(1, Number(maxAttempts) || 1),
    });
    return NextResponse.json(job, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create job' }, { status: 400 });
  }
}
