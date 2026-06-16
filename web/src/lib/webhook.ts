import {
  buildMemberLogEmbed,
  type MemberLogPayload,
} from '@shared/member-log-embed';

type WebhookField = { name: string; value: string; inline?: boolean };

const COLORS = {
  success: 0x22c55e,
  danger: 0xef4444,
  warning: 0xeab308,
  info: 0x3b82f6,
  neutral: 0x6b7280,
} as const;

type WebhookKind = 'join' | 'kick' | 'leave';

function getWebhookUrl(kind: WebhookKind) {
  if (kind === 'join') {
    return (
      process.env.DISCORD_JOIN_WEBHOOK_URL ??
      process.env.DISCORD_WEBHOOK_URL ??
      process.env.DISCORD_ADMIN_WEBHOOK_URL ??
      ''
    );
  }
  if (kind === 'kick') {
    return (
      process.env.DISCORD_KICK_WEBHOOK_URL ??
      process.env.DISCORD_WEBHOOK_URL ??
      process.env.DISCORD_ADMIN_WEBHOOK_URL ??
      ''
    );
  }
  return (
    process.env.DISCORD_LEAVE_WEBHOOK_URL ??
    process.env.DISCORD_WEBHOOK_URL ??
    process.env.DISCORD_ADMIN_WEBHOOK_URL ??
    ''
  );
}

async function sendEmbed(kind: WebhookKind, title: string, fields: WebhookField[], color: number) {
  const url = getWebhookUrl(kind);
  if (!url) {
    console.warn(`[webhook] ${kind} 웹훅 URL이 설정되지 않았습니다. (${title})`);
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ title, color, fields, timestamp: new Date().toISOString() }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[webhook] ${kind} 전송 실패 (${res.status}): ${body.slice(0, 200)}`);
    }
  } catch (error) {
    console.error(`[webhook] ${kind} 전송 오류:`, error);
  }
}

async function sendMemberLog(kind: 'kick' | 'leave', payload: MemberLogPayload) {
  const url = getWebhookUrl(kind);
  if (!url) {
    console.warn(`[webhook] ${kind} 웹훅 URL이 설정되지 않았습니다.`);
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [buildMemberLogEmbed({ ...payload, kind })],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[webhook] ${kind} 전송 실패 (${res.status}): ${body.slice(0, 200)}`);
    }
  } catch (error) {
    console.error(`[webhook] ${kind} 전송 오류:`, error);
  }
}

export const adminWebhook = {
  applicationApproved: (fields: WebhookField[]) =>
    sendEmbed('join', '✅ 가입 승인 완료', fields, COLORS.success),
  applicationRejected: (fields: WebhookField[]) =>
    sendEmbed('join', '❌ 가입 거절', fields, COLORS.danger),
  warningIssued: (fields: WebhookField[]) =>
    sendEmbed('join', '⚠️ 경고 부여', fields, COLORS.warning),
  memberKicked: (payload: MemberLogPayload) => sendMemberLog('kick', payload),
  memberLeft: (payload: MemberLogPayload) => sendMemberLog('leave', payload),
  nicknameChanged: (fields: WebhookField[]) =>
    sendEmbed('join', '📝 별명 변경 완료', fields, COLORS.info),
  adminAction: (fields: WebhookField[]) =>
    sendEmbed('join', '🔧 관리자 조작 로그', fields, COLORS.neutral),
  blacklistRegistered: (fields: WebhookField[]) =>
    sendEmbed('join', '⛔ 블랙리스트 등록', fields, COLORS.danger),
  blacklistRemoved: (fields: WebhookField[]) =>
    sendEmbed('join', '✅ 블랙리스트 해제', fields, COLORS.success),
};
