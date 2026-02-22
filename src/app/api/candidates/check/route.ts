import { NextResponse } from 'next/server';
import { canAttempt, getAttemptCount, getJob } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const email = searchParams.get('email');
  if (!jobId || !email) return NextResponse.json({ error: 'jobId and email required' }, { status: 400 });

  const job = getJob(jobId);
  const attemptCount = getAttemptCount(jobId, email);
  const maxAttempts = job ? (job.maxAttempts > 0 ? job.maxAttempts : 1) : 1;

  return NextResponse.json({
    canAttempt: canAttempt(jobId, email),
    attemptCount,
    maxAttempts,
    attemptsRemaining: Math.max(0, maxAttempts - attemptCount),
  });
}
