import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findRecruiterById } from '@/lib/db';

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const recruiter = findRecruiterById(session.recruiterId);
  if (!recruiter) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { password: _pw, ...safe } = recruiter;
  return NextResponse.json(safe);
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('dmless_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  return response;
}
