export type MemberLogKind = 'kick' | 'leave';

export interface MemberLogPayload {
  targetName: string;
  targetUserId: string;
  executor?: string | null;
  reason?: string | null;
  avatarUrl?: string | null;
  kind: MemberLogKind;
}

/** Discord 퇴장/추방 로그 임베드 색상 (주황·골드) */
export const MEMBER_LOG_COLOR = 0xfaa61a;

export function discordDefaultAvatarUrl(userId: string): string {
  try {
    const index = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

export function buildMemberLogEmbed(payload: MemberLogPayload) {
  const typeLabel = payload.kind === 'kick' ? '추방' : '퇴장';
  const title = payload.kind === 'kick' ? '🚫 추방' : '👋 퇴장';

  return {
    title,
    color: MEMBER_LOG_COLOR,
    thumbnail: {
      url: payload.avatarUrl ?? discordDefaultAvatarUrl(payload.targetUserId),
    },
    fields: [
      {
        name: '대상',
        value: `${payload.targetName}\n(${payload.targetUserId})`,
        inline: true,
      },
      {
        name: '처리자',
        value: payload.executor?.trim() || '알 수 없음',
        inline: true,
      },
      {
        name: '유형',
        value: typeLabel,
        inline: true,
      },
      {
        name: '사유',
        value: payload.reason?.trim() || '사유 없음',
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}
