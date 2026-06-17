import { AuditLogEvent, type GuildMember, type PartialGuildMember } from 'discord.js';
import { supabase, logActivity } from '../db/supabase.js';
import { webhook } from '../services/webhook.js';
import { config } from '../config.js';
import { formatMemberLogDate } from '../lib/member-log-embed.js';

const AUDIT_LOG_CUTOFF_MS = 15_000;

interface LeaveInfo {
  kind: 'kick' | 'ban' | 'voluntary';
  executor?: string;
  reason?: string;
  logReason: string;
  status: string;
}

async function detectLeaveInfo(
  member: GuildMember | PartialGuildMember
): Promise<LeaveInfo> {
  if (!member.guild) {
    return {
      kind: 'voluntary',
      logReason: '자발적 서버 탈퇴',
      status: '서버에서 자진 탈퇴했습니다.',
    };
  }

  try {
    const now = Date.now();
    const [kickLogs, banLogs] = await Promise.all([
      member.guild.fetchAuditLogs({ limit: 6, type: AuditLogEvent.MemberKick }),
      member.guild.fetchAuditLogs({ limit: 6, type: AuditLogEvent.MemberBanAdd }),
    ]);

    const banEntry = banLogs.entries.find(
      (entry) =>
        entry.target?.id === member.id && now - entry.createdTimestamp < AUDIT_LOG_CUTOFF_MS
    );

    if (banEntry) {
      const executor = banEntry.executor?.username ?? '관리자';
      const reason = banEntry.reason ?? undefined;
      return {
        kind: 'ban',
        executor,
        reason,
        logReason: reason ? `차단 (${executor}): ${reason}` : `관리자 차단 (${executor})`,
        status: '서버에서 밴 처리되었습니다.',
      };
    }

    const kickEntry = kickLogs.entries.find(
      (entry) =>
        entry.target?.id === member.id && now - entry.createdTimestamp < AUDIT_LOG_CUTOFF_MS
    );

    if (kickEntry) {
      const executor = kickEntry.executor?.username ?? '관리자';
      const reason = kickEntry.reason ?? undefined;
      return {
        kind: 'kick',
        executor,
        reason,
        logReason: reason ? `추방 (${executor}): ${reason}` : `관리자 추방 (${executor})`,
        status: '서버에서 추방 처리되었습니다.',
      };
    }
  } catch (error) {
    console.warn('Audit log 조회 실패:', error);
  }

  return {
    kind: 'voluntary',
    logReason: '자발적 서버 탈퇴',
    status: '서버에서 자진 탈퇴했습니다.',
  };
}

export async function handleMemberLeave(member: GuildMember | PartialGuildMember) {
  if (member.guild.id !== config.guildId) return;

  const leftAt = new Date();
  const leaveInfo = await detectLeaveInfo(member);
  const displayName = member.displayName || member.user?.username || '알 수 없음';
  const targetTag = member.user?.tag ?? null;
  const isForced = leaveInfo.kind === 'kick' || leaveInfo.kind === 'ban';
  const leftAtLabel = formatMemberLogDate(leftAt);

  const logPayload = {
    targetName: displayName,
    targetTag,
    targetUserId: member.id,
    executor: leaveInfo.executor,
    reason: isForced ? leaveInfo.reason ?? '사유 없음' : '자진 탈퇴',
    avatarUrl: member.user?.displayAvatarURL({ size: 128 }) ?? null,
    leftAt: leftAtLabel,
    status: leaveInfo.status,
    kind: isForced ? ('kick' as const) : ('leave' as const),
  };

  if (isForced) {
    await webhook.memberKicked(logPayload);
  } else {
    await webhook.serverMemberLeft(logPayload);
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, sudden_nickname, server_nickname, status')
    .eq('discord_user_id', member.id)
    .in('status', ['approved', 'pending'])
    .maybeSingle();

  if (!user) {
    console.log(`Member leave webhook sent (non-clan): ${displayName} (${member.id})`);
    return;
  }

  const serverNickname =
    member.nickname ?? user.server_nickname ?? user.sudden_nickname ?? '없음';
  const newStatus = isForced ? 'kicked' : 'left';
  const logDescription = `서버별명: ${serverNickname} | 탈퇴날짜: ${leftAtLabel} | 사유: ${leaveInfo.logReason} | 유저ID: ${member.id}`;
  const logAction = isForced ? '추방 처리' : '탈퇴 처리';

  await supabase
    .from('users')
    .update({ status: newStatus, updated_at: leftAt.toISOString() })
    .eq('id', user.id);

  await logActivity(logAction, logDescription, user.id, 'Discord Bot');

  console.log(`Member leave logged: ${serverNickname} (${member.id})`);
}
