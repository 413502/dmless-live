// lib/auth.ts
import { cookies } from 'next/headers';

export function getSession(): { recruiterId: string } | null {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get('dmless_session');
    if (!session?.value) return null;
    const decoded = Buffer.from(session.value, 'base64').toString('utf-8');
    const data = JSON.parse(decoded);
    if (!data?.recruiterId || typeof data.recruiterId !== 'string') return null;
    return { recruiterId: data.recruiterId };
  } catch {
    return null;
  }
}

export function createSessionToken(recruiterId: string): string {
  return Buffer.from(JSON.stringify({ recruiterId, ts: Date.now() })).toString('base64');
}
