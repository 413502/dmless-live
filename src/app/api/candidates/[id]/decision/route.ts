import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubmissionById, updateSubmission, getJob } from '@/lib/db';

/**
 * PATCH /api/candidates/[id]/decision
 *
 * Body: { decision: 'hired' | 'rejected_after_screening' }
 *
 * Auth: recruiter must own the job this candidate applied to.
 * Only applies to candidates who passed MCQs (status != knocked_out).
 * Persists the update to db.json immediately.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let decision: string;
  try {
    const body = await request.json();
    decision = body?.decision ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (decision !== 'hired' && decision !== 'rejected_after_screening') {
    return NextResponse.json(
      { error: 'decision must be "hired" or "rejected_after_screening"' },
      { status: 400 }
    );
  }

  const submission = getSubmissionById(params.id);
  if (!submission) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  // Verify the recruiter owns this job
  const job = getJob(submission.jobId);
  if (!job || job.recruiterId !== session.recruiterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cannot change decision on knocked-out candidates
  if (submission.status === 'knocked_out') {
    return NextResponse.json(
      { error: 'Cannot set a hiring decision on a knocked-out candidate' },
      { status: 400 }
    );
  }

  const updated = updateSubmission(params.id, {
    status: decision as 'hired' | 'rejected_after_screening',
  });

  return NextResponse.json({ success: true, id: updated?.id, status: updated?.status });
}
