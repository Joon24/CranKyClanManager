export type MemberLogKind = 'kick' | 'leave';

export interface MemberLogPayload {
  targetName: string;
  targetTag?: string | null;
  targetUserId: string;
  executor?: string | null;
  reason?: string | null;
  avatarUrl?: string | null;
  leftAt?: string | null;
  status?: string | null;
  kind: MemberLogKind;
}

/** Discord 퇴장/추방 로그 임베드 색상 (주황) */
export const MEMBER_LOG_COLOR = 0xff6600;

export function discordDefaultAvatarUrl(userId: string): string {
  try {
    const index = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

export function formatMemberLogDate(date = new Date()) {
  return date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
}

export function buildMemberLogEmbed(payload: MemberLogPayload) {
  const targetLabel = payload.targetTag
    ? `${payload.targetName} (${payload.targetTag})`
    : payload.targetName;

  const status =
    payload.status ??
    (payload.kind === 'kick'
      ? '서버에서 추방 처리되었습니다.'
      : '서버에서 자진 탈퇴했습니다.');

  return {
    title: '🚪 멤버 추방',
    color: MEMBER_LOG_COLOR,
    thumbnail: {
      url: payload.avatarUrl ?? discordDefaultAvatarUrl(payload.targetUserId),
    },
    fields: [
      { name: '대상', value: targetLabel, inline: false },
      { name: '사유', value: payload.reason?.trim() || '사유 없음', inline: false },
      { name: '유저 ID', value: payload.targetUserId, inline: false },
      {
        name: '퇴장 시간',
        value: payload.leftAt ?? formatMemberLogDate(),
        inline: false,
      },
      { name: '상태', value: status, inline: false },
    ],
    timestamp: new Date().toISOString(),
  };
}
