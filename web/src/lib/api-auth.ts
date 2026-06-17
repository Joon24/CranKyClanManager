import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import type { Session } from 'next-auth';

export function getAdminDisplayName(session: Session): string {
  return (
    session.user?.serverNickname?.trim() ||
    session.user?.name?.trim() ||
    session.user?.username?.trim() ||
    '관리자'
  );
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session };
}
