import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJob, updateJob, updateJobStatus, getJobAnalytics, getSubmissionsByJob } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const job = getJob(params.id);
  if (!job || job.recruiterId !== session.recruiterId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const analytics = getJobAnalytics(params.id);
  const submissions = getSubmissionsByJob(params.id);
  return NextResponse.json({ ...job, analytics, submissions });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const job = getJob(params.id);
  if (!job || job.recruiterId !== session.recruiterId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = await request.json();

  // If only status is being toggled
  if (Object.keys(body).length === 1 && body.status !== undefined) {
    if (body.status !== 'open' && body.status !== 'closed') {
      return NextResponse.json({ error: 'status must be "open" or "closed"' }, { status: 400 });
    }
    const updated = updateJobStatus(params.id, body.status);
    return NextResponse.json(updated);
  }

  // Full edit
  const { title, description, mcqs, timeLimitMinutes, maxAttempts, status } = body;

  if (mcqs !== undefined) {
    if (!Array.isArray(mcqs) || mcqs.length !== 5) {
      return NextResponse.json({ error: 'Exactly 5 MCQs required' }, { status: 400 });
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
  }

  const updated = updateJob(params.id, {
    ...(title !== undefined && { title: String(title).trim() }),
    ...(description !== undefined && { description: String(description).trim() }),
    ...(mcqs !== undefined && { mcqs }),
    ...(timeLimitMinutes !== undefined && { timeLimitMinutes: Number(timeLimitMinutes) || 0 }),
    ...(maxAttempts !== undefined && { maxAttempts: Math.max(1, Number(maxAttempts) || 1) }),
    ...(status !== undefined && (status === 'open' || status === 'closed') && { status }),
  });

  return NextResponse.json(updated);
}
