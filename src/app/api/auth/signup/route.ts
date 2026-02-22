import { NextResponse } from 'next/server';
import { createRecruiter } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body ?? {};

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const recruiter = createRecruiter(email, password, name);
    const token = createSessionToken(recruiter.id);

    const response = NextResponse.json({ success: true, name: recruiter.name }, { status: 201 });
    response.cookies.set('dmless_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Signup failed' }, { status: 400 });
  }
}
