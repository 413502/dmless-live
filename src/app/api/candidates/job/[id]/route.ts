import { NextResponse } from 'next/server';
import { getJob } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const job = getJob(params.id);
  if (!job) return NextResponse.json({ error: 'Job not found. The link may be invalid.' }, { status: 404 });

  // Strip correct answers before sending to candidate
  const safeMcqs = job.mcqs.map(mcq => ({
    id: mcq.id,
    question: mcq.question,
    options: mcq.options,
  }));

  return NextResponse.json({
    id: job.id,
    title: job.title,
    description: job.description,
    status: job.status,
    mcqs: safeMcqs,
    timeLimitMinutes: job.timeLimitMinutes,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
  });
}
