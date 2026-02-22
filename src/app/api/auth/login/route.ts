import { NextResponse } from 'next/server';
import { findRecruiterByEmail } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const recruiter = findRecruiterByEmail(email);
    if (!recruiter || recruiter.password !== String(password)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = createSessionToken(recruiter.id);
    const response = NextResponse.json({ success: true, name: recruiter.name });
    response.cookies.set('dmless_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
