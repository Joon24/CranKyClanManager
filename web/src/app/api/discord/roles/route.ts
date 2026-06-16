import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { botGetRoles } from '@/lib/bot-api';
import { getKnownClanRoles } from '@/lib/discord-roles';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const roles = await botGetRoles();
    const knownIds = new Set(getKnownClanRoles().map((r) => r.id));
    const clanRoles = roles.filter((r) => knownIds.has(r.id));
    if (clanRoles.length > 0) return NextResponse.json(clanRoles);
  } catch {
    // 봇 미연결(배포 환경 등) — 아래 폴백 사용
  }

  return NextResponse.json(getKnownClanRoles());
}
