import { AuditLogEvent, type GuildMember, type PartialGuildMember } from 'discord.js';
import { supabase, logActivity } from '../db/supabase.js';
import { webhook } from '../services/webhook.js';
import { config } from '../config.js';

function formatLeaveDate(date: Date) {
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface LeaveInfo {
  kind: 'kick' | 'ban' | 'voluntary';
  executor?: string;
  reason?: string;
  logReason: string;
}

async function detectLeaveInfo(
  member: GuildMember | PartialGuildMember
): Promise<LeaveInfo> {
  if (!member.guild) {
    return { kind: 'voluntary', logReason: '자발적 서버 탈퇴' };
  }

  try {
    const kickLogs = await member.guild.fetchAuditLogs({
      limit: 6,
      type: AuditLogEvent.MemberKick,
    });

    const kickEntry = kickLogs.entries.find(
      (entry) =>
        entry.target?.id === member.id && Date.now() - entry.createdTimestamp < 10_000
    );

    if (kickEntry) {
      const executor = kickEntry.executor?.username ?? '관리자';
      const reason = kickEntry.reason ?? undefined;
      return {
        kind: 'kick',
        executor,
        reason,
        logReason: reason ? `추방 (${executor}): ${reason}` : `관리자 추방 (${executor})`,
      };
    }

    const banLogs = await member.guild.fetchAuditLogs({
      limit: 6,
      type: AuditLogEvent.MemberBanAdd,
    });

    const banEntry = banLogs.entries.find(
      (entry) =>
        entry.target?.id === member.id && Date.now() - entry.createdTimestamp < 10_000
    );

    if (banEntry) {
      const executor = banEntry.executor?.username ?? '관리자';
      const reason = banEntry.reason ?? undefined;
      return {
        kind: 'ban',
        executor,
        reason,
        logReason: reason ? `차단 (${executor}): ${reason}` : `관리자 차단 (${executor})`,
      };
    }
  } catch (error) {
    console.warn('Audit log 조회 실패:', error);
  }

  return { kind: 'voluntary', logReason: '자발적 서버 탈퇴' };
}

export async function handleMemberLeave(member: GuildMember | PartialGuildMember) {
  if (member.guild.id !== config.guildId) return;

  const { data: user } = await supabase
    .from('users')
    .select('id, sudden_nickname, server_nickname, status')
    .eq('discord_user_id', member.id)
    .in('status', ['approved', 'pending'])
    .maybeSingle();

  if (!user) return;

  const leftAt = new Date();
  const leaveInfo = await detectLeaveInfo(member);
  const serverNickname =
    member.nickname ?? user.server_nickname ?? user.sudden_nickname ?? '없음';
  const targetName = member.user?.username ?? serverNickname;

  const isKick = leaveInfo.kind === 'kick' || leaveInfo.kind === 'ban';
  const newStatus = isKick ? 'kicked' : 'left';
  const leftAtLabel = formatLeaveDate(leftAt);
  const logDescription = `서버별명: ${serverNickname} | 탈퇴날짜: ${leftAtLabel} | 사유: ${leaveInfo.logReason} | 유저ID: ${member.id}`;
  const logAction = isKick ? '추방 처리' : '탈퇴 처리';

  await supabase
    .from('users')
    .update({ status: newStatus, updated_at: leftAt.toISOString() })
    .eq('id', user.id);

  const logPayload = {
    targetName,
    targetUserId: member.id,
    executor: leaveInfo.executor,
    reason: leaveInfo.reason,
    avatarUrl: member.user?.displayAvatarURL({ size: 128 }) ?? null,
    kind: isKick ? ('kick' as const) : ('leave' as const),
  };

  if (isKick) {
    await webhook.memberKicked(logPayload);
  } else {
    await webhook.serverMemberLeft(logPayload);
  }

  await logActivity(logAction, logDescription, user.id, 'Discord Bot');

  console.log(`Member leave logged: ${serverNickname} (${member.id})`);
}
