import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSubmissionById, updateSubmission, getJob } from '@/lib/db';

/**
 * PATCH /api/candidates/[id]/undo
 *
 * Reverts a hired or rejected_after_screening candidate back to "shortlisted".
 * No confirmation required — immediate state change.
 * Auth: recruiter must own the job this candidate applied to.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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

  // Only allow undo on hired or rejected candidates
  if (submission.status !== 'hired' && submission.status !== 'rejected_after_screening') {
    return NextResponse.json(
      { error: 'Can only undo hired or rejected candidates' },
      { status: 400 }
    );
  }

  const updated = updateSubmission(params.id, { status: 'shortlisted' });

  return NextResponse.json({ success: true, id: updated?.id, status: updated?.status });
}
