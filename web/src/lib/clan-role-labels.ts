/** 클랜 역할 ID → 표시명 (클라이언트 폴백, 서버 discord-roles.ts 와 동일) */
export const CLAN_ROLE_LABELS: Record<string, string> = {
  '1489800769371766954': '클랜원',
  '1489852005005656064': '열혈클랜원',
  '1489797598133882910': '운영진',
  '1489807656939163850': '용병',
};

export function clanRoleLabel(roleId: string): string {
  return CLAN_ROLE_LABELS[roleId] ?? roleId;
}

export const CLAN_ROLE_OPTIONS = Object.entries(CLAN_ROLE_LABELS).map(([id, name]) => ({
  id,
  name,
  color: '#5865f2',
}));
