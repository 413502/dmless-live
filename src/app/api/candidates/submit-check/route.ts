/**
 * POST /api/candidates/submit-check
 *
 * Evaluates a SINGLE MCQ answer in real time (per-question knockout).
 * Called after every "Next" click BEFORE the last question.
 *
 * Does NOT save anything to DB — it only validates the answer.
 * The actual DB save happens via /api/candidates/submit when:
 *   - Candidate is knocked out (saveKnockout path)
 *   - Candidate completes all questions
 *
 * Response:
 *   { correct: true }  → frontend advances to next question
 *   { correct: false, message: string } → frontend shows knockout screen
 */

import { NextResponse } from 'next/server';
import { getJob, canAttempt } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, email, questionIndex, answer } = body ?? {};

    if (!jobId || !email || questionIndex === undefined || answer === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.status === 'closed') return NextResponse.json({ error: 'Job is closed' }, { status: 403 });

    const normEmail = String(email).toLowerCase().trim();

    if (!canAttempt(jobId, normEmail)) {
      return NextResponse.json({
        error: 'You have already submitted an application for this role.',
        alreadyAttempted: true,
      }, { status: 403 });
    }

    const idx = Number(questionIndex);
    if (idx < 0 || idx >= job.mcqs.length) {
      return NextResponse.json({ error: 'Invalid question index' }, { status: 400 });
    }

    const correctIndex = job.mcqs[idx].correctIndex;
    const isCorrect = Number(answer) === correctIndex;

    if (isCorrect) {
      return NextResponse.json({ correct: true });
    }

    // Wrong answer
    return NextResponse.json({
      correct: false,
      message: `Thank you for your time. Unfortunately, your answer to Question ${idx + 1} was incorrect. This role requires full accuracy on all screening questions. Better luck next time!`,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Check failed' }, { status: 500 });
  }
}
