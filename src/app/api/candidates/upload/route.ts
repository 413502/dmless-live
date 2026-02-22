import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSubmissionByJobAndEmail, updateSubmission } from '@/lib/db';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTS = ['.pdf', '.docx', '.doc'];
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;
    const jobId = formData.get('jobId') as string | null;
    const email = formData.get('email') as string | null;

    if (!file || !jobId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: resume, jobId, email' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    if (!ALLOWED_EXTS.some(ext => fileName.endsWith(ext))) {
      return NextResponse.json(
        { error: 'Only PDF, DOC, and DOCX files are accepted' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File must be under 5 MB' },
        { status: 400 }
      );
    }

    /* ───────────────── DEV MODE SAFE EXIT ───────────────── */
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (!blobToken || blobToken.trim().length === 0) {
      return NextResponse.json({
        success: true,
        devOnly: true,
        message:
          'Application received. Resume upload works on the deployed version.',
        fileName: file.name,
      });
    }
    /* ─────────────────────────────────────────────────────── */

    const submission = getSubmissionByJobAndEmail(jobId, email);
    if (!submission) {
      return NextResponse.json(
        { error: 'No submission found for this email and job' },
        { status: 404 }
      );
    }

    const blobPath = `resumes/${jobId}/${submission.id}-${Date.now()}-${file.name}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    });

    updateSubmission(submission.id, {
      resumeFileName: file.name,
      resumeSize: file.size,
      resumeMimeType: file.type || 'application/octet-stream',
      resumeUrl: blob.url,
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Resume uploaded successfully!',
      fileName: file.name,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Upload failed: ' + (err.message || 'Unknown error') },
      { status: 500 }
    );
  }
}