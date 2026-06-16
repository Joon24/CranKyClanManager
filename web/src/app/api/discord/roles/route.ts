import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { botGetRoles } from '@/lib/bot-api';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const roles = await botGetRoles();
    return NextResponse.json(roles);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '역할 목록 조회 실패' },
      { status: 500 }
    );
  }
}
