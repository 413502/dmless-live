import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDashboardStats } from '@/lib/db';

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(getDashboardStats(session.recruiterId));
}
