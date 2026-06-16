import { config } from '../config.js';
import { buildMemberLogEmbed, type MemberLogPayload } from '../lib/member-log-embed.js';

type WebhookField = { name: string; value: string; inline?: boolean };

const COLORS = {
  success: 0x22c55e,
  danger: 0xef4444,
  warning: 0xeab308,
  info: 0x3b82f6,
  neutral: 0x6b7280,
} as const;

function getWebhookUrl(kind: 'join' | 'kick' | 'leave') {
  if (kind === 'join') return config.joinWebhookUrl || config.webhookUrl;
  if (kind === 'kick') return config.kickWebhookUrl || config.webhookUrl;
  return config.leaveWebhookUrl || config.webhookUrl;
}

async function sendEmbed(
  kind: 'join' | 'kick' | 'leave',
  title: string,
  fields: WebhookField[],
  color: number
) {
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

export const webhook = {
  applicationReceived(fields: WebhookField[]) {
    return sendEmbed('join', '✅ 가입 신청 접수', fields, COLORS.info);
  },
  applicationApproved(fields: WebhookField[]) {
    return sendEmbed('join', '✅ 가입 승인 완료', fields, COLORS.success);
  },
  applicationRejected(fields: WebhookField[]) {
    return sendEmbed('join', '❌ 가입 거절', fields, COLORS.danger);
  },
  warningIssued(fields: WebhookField[]) {
    return sendEmbed('join', '⚠️ 경고 부여', fields, COLORS.warning);
  },
  memberKicked(payload: MemberLogPayload) {
    return sendMemberLog('kick', payload);
  },
  memberLeft(payload: MemberLogPayload) {
    return sendMemberLog('leave', payload);
  },
  serverMemberLeft(payload: MemberLogPayload) {
    return sendMemberLog('leave', payload);
  },
  nicknameChanged(fields: WebhookField[]) {
    return sendEmbed('join', '📝 별명 변경 완료', fields, COLORS.info);
  },
  mercenaryAutoApproved(fields: WebhookField[]) {
    return sendEmbed('join', '⚔️ 용병 자동 승인', fields, COLORS.success);
  },
  adminAction(fields: WebhookField[]) {
    return sendEmbed('join', '🔧 관리자 조작 로그', fields, COLORS.neutral);
  },
  blacklistRegistered(fields: WebhookField[]) {
    return sendEmbed('join', '⛔ 블랙리스트 등록', fields, COLORS.danger);
  },
  blacklistRejoinBlocked(fields: WebhookField[]) {
    return sendEmbed('join', '🚫 블랙리스트 재입장 차단', fields, COLORS.danger);
  },
  blacklistRemoved(fields: WebhookField[]) {
    return sendEmbed('join', '✅ 블랙리스트 해제', fields, COLORS.success);
  },
};
