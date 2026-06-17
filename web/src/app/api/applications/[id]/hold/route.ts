import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminDisplayName } from '@/lib/api-auth';
import { holdApplication } from '@/lib/application-actions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const adminName = getAdminDisplayName(auth.session!);

  try {
    await holdApplication(id, adminName, body.memo);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '보류 처리 실패' },
      { status: 400 }
    );
  }
}
