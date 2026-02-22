import { NextResponse } from 'next/server';
import { getJob, canAttempt, createSubmission } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, name, email, answers, timeTakenSeconds, forceKnockoutAt } = body ?? {};

    if (!jobId || !name || !email || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required fields: jobId, name, email, answers' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.status === 'closed') {
      return NextResponse.json({ error: 'This job is no longer accepting applications' }, { status: 403 });
    }

    const normEmail = email.toLowerCase().trim();

    if (!canAttempt(jobId, normEmail)) {
      const max = job.maxAttempts > 0 ? job.maxAttempts : 1;
      return NextResponse.json({
        error: max === 1
          ? 'You have already attempted this test. Each candidate may only attempt once.'
          : `You have reached the maximum number of attempts (${max}) for this test.`,
        alreadyAttempted: true,
      }, { status: 403 });
    }

    // Pad answers array to match MCQ count if partial submission (mid-knockout save)
    const paddedAnswers: number[] = job.mcqs.map((_, i) => {
      const a = answers[i];
      return a !== undefined && a !== null ? Number(a) : -1;
    });

    // If forceKnockoutAt is provided, override detection to use that index
    let knockoutIndex: number | undefined;
    if (typeof forceKnockoutAt === 'number' && forceKnockoutAt >= 0) {
      knockoutIndex = forceKnockoutAt;
    } else {
      // Standard sequential evaluation
      for (let i = 0; i < job.mcqs.length; i++) {
        if (paddedAnswers[i] !== job.mcqs[i].correctIndex) {
          knockoutIndex = i;
          break;
        }
      }
    }

    const status = knockoutIndex !== undefined ? 'knocked_out' : 'shortlisted';

    const submission = createSubmission({
      jobId,
      name: name.trim(),
      email: normEmail,
      status,
      knockoutMcqIndex: knockoutIndex,
      answers: paddedAnswers,
      timeTakenSeconds: timeTakenSeconds ? Number(timeTakenSeconds) : undefined,
    });

    if (status === 'knocked_out') {
      const qNum = knockoutIndex! + 1;
      return NextResponse.json({
        result: 'knocked_out',
        submissionId: submission.id,
        failedAt: qNum,
        message: `Thank you for applying. Unfortunately, your answer to Question ${qNum} was incorrect. This role requires full accuracy on all screening questions. Better luck next time!`,
      });
    }

    return NextResponse.json({
      result: 'passed',
      submissionId: submission.id,
      message: 'Excellent work! You answered all screening questions correctly. Please upload your resume to complete your application.',
    });
  } catch (err: any) {
    console.error('[submit]', err);
    return NextResponse.json({ error: err.message || 'Submission failed' }, { status: 500 });
  }
}
