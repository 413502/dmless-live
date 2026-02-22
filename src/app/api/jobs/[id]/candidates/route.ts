/**
 * GET /api/jobs/[id]/candidates
 *
 * Returns all shortlisted, hired, and rejected_after_screening candidates
 * for a job. Auth-gated to the job's recruiter only.
 *
 * Resumé files are stored as metadata only (fileName, size, mimeType).
 * The download link is constructed client-side as a placeholder — in
 * production you'd point this to an actual file storage URL.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getJob, getSubmissionsByJob } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const job = getJob(params.id);
  if (!job || job.recruiterId !== session.recruiterId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const all = getSubmissionsByJob(params.id);
  // Only return candidates who passed MCQs (shortlisted, hired, or rejected after screening)
  const candidates = all
    .filter(s => s.status === 'shortlisted' || s.status === 'hired' || s.status === 'rejected_after_screening')
    .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
    .map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      status: s.status,
      resumeFileName: s.resumeFileName ?? null,
      resumeSize: s.resumeSize ?? null,
      resumeUrl: s.resumeUrl ?? null,
      attemptedAt: s.attemptedAt,
      completedAt: s.completedAt ?? null,
    }));

  return NextResponse.json({ job: { id: job.id, title: job.title }, candidates });
}
