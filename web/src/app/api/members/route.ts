import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getAdminDisplayName } from '@/lib/api-auth';
import { supabase, logActivity } from '@/lib/supabase';
import { adminWebhook } from '@/lib/webhook';
import { botChangeRole } from '@/lib/bot-api';
import { getMercenaryRoleId } from '@/lib/discord-roles';
import { discordDefaultAvatarUrl, formatMemberLogDate } from '@shared/member-log-embed';

function isMercenaryContext(memberType: string | null | undefined, context?: string) {
  return memberType === 'mercenary' || context === 'mercenary';
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const mercenaryRoleId = getMercenaryRoleId();

  let query = supabase
    .from('users')
    .select('*, match_stats(kd, win_rate, rank_name, tier_name, suspicion_level)')
    .or('member_type.eq.member,member_type.is.null')
    .order('created_at', { ascending: false });

  if (mercenaryRoleId) {
    query = query.neq('role', mercenaryRoleId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json();
  const adminName = getAdminDisplayName(auth.session!);
  const { userId, action, context, ...payload } = body;

  if (!userId || !action) {
    return NextResponse.json({ error: 'userId and action required' }, { status: 400 });
  }

  const { data: user } = await supabase
    .from('users')
    .select('sudden_nickname, server_nickname, discord_user_id, discord_username, role, member_type')
    .eq('id', userId)
    .single();

  const nickname = user?.sudden_nickname ?? userId;
  const serverNickname = user?.server_nickname ?? nickname;
  const mercenary = isMercenaryContext(user?.member_type, context);

  switch (action) {
    case 'change_role': {
      if (!user?.discord_user_id || !payload.roleId) {
        return NextResponse.json({ error: 'roleId required' }, { status: 400 });
      }

      const result = await botChangeRole({
        discordUserId: user.discord_user_id,
        roleId: payload.roleId,
        previousRoleId: user.role,
      });

      await supabase.from('users').update({ role: result.roleId }).eq('id', userId);

      await logActivity(
        mercenary ? '용병 역할 변경' : '등급 변경',
        `${result.roleName} (${result.roleId})`,
        userId,
        adminName
      );

      await adminWebhook.adminAction([
        { name: '액션', value: mercenary ? '용병 역할 변경' : '역할 변경', inline: true },
        { name: '대상', value: nickname, inline: true },
        { name: '변경 역할', value: result.roleName, inline: true },
        { name: '처리자', value: adminName, inline: true },
      ]);
      break;
    }
    case 'warn': {
      await supabase.from('warnings').insert({
        user_id: userId,
        warning_type: payload.warning_type ?? (mercenary ? 'mercenary' : 'general'),
        reason: payload.reason,
        point: payload.point ?? 1,
        created_by: adminName,
      });
      await logActivity(mercenary ? '용병 경고' : '경고 부여', payload.reason, userId, adminName);
      await adminWebhook.warningIssued([
        { name: '대상', value: nickname, inline: true },
        { name: '유형', value: mercenary ? '용병' : '클랜원', inline: true },
        { name: '사유', value: payload.reason, inline: false },
        { name: '점수', value: String(payload.point ?? 1), inline: true },
        { name: '처리자', value: adminName, inline: true },
      ]);
      break;
    }
    case 'kick': {
      await supabase.from('users').update({ status: 'kicked' }).eq('id', userId);
      await logActivity(
        mercenary ? '용병 추방' : '추방 처리',
        payload.reason ?? '추방',
        userId,
        adminName
      );
      await adminWebhook.memberKicked({
        targetName: user?.discord_username ?? nickname,
        targetUserId: user?.discord_user_id ?? userId,
        executor: adminName,
        reason: payload.reason ?? '사유 없음',
        leftAt: formatMemberLogDate(),
        status: '서버에서 추방 처리되었습니다.',
        avatarUrl: user?.discord_user_id
          ? discordDefaultAvatarUrl(user.discord_user_id)
          : null,
        kind: 'kick',
      });
      break;
    }
    case 'leave': {
      await supabase.from('users').update({ status: 'left' }).eq('id', userId);
      const leftAt = new Date().toLocaleString('ko-KR');
      await logActivity(
        mercenary ? '용병 탈퇴' : '탈퇴 처리',
        `서버별명: ${serverNickname} | 탈퇴날짜: ${leftAt} | 사유: 관리자 탈퇴 처리 | 유저ID: ${user?.discord_user_id ?? '-'}`,
        userId,
        adminName
      );
      await adminWebhook.memberLeft({
        targetName: user?.discord_username ?? nickname,
        targetUserId: user?.discord_user_id ?? userId,
        executor: adminName,
        reason: '관리자 탈퇴 처리',
        leftAt: formatMemberLogDate(),
        status: '서버에서 자진 탈퇴했습니다.',
        avatarUrl: user?.discord_user_id
          ? discordDefaultAvatarUrl(user.discord_user_id)
          : null,
        kind: 'leave',
      });
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
