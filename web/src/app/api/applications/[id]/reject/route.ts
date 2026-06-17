import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminDisplayName } from '@/lib/api-auth';
import { rejectApplication } from '@/lib/application-actions';

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
    await rejectApplication(id, adminName, body.reason);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '거절 처리 실패' },
      { status: 400 }
    );
  }
}
