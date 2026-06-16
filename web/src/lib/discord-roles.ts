/** Discord 용병 역할 ID (bot/.env DISCORD_MERCENARY_ROLE_ID 와 동일하게 설정) */
export function getMercenaryRoleId(): string {
  return process.env.DISCORD_MERCENARY_ROLE_ID ?? '';
}

export function getMemberRoleId(): string {
  return process.env.DISCORD_MEMBER_ROLE_ID ?? '1489800769371766954';
}

export function getEnthusiastRoleId(): string {
  return process.env.DISCORD_ENTHUSIAST_ROLE_ID ?? '1489852005005656064';
}

export function getStaffRoleId(): string {
  return process.env.DISCORD_STAFF_ROLE_ID ?? '1489797598133882910';
}

export interface ClanRoleOption {
  id: string;
  name: string;
  color: string;
}

/** 봇 API 없이도 표시할 클랜 역할 (배포 환경 폴백) */
export function getKnownClanRoles(): ClanRoleOption[] {
  const roles: ClanRoleOption[] = [
    { id: getMemberRoleId(), name: '클랜원', color: '#5865f2' },
    { id: getEnthusiastRoleId(), name: '열혈클랜원', color: '#e91e63' },
    { id: getStaffRoleId(), name: '운영진', color: '#f59e0b' },
  ];
  const mercenaryId = getMercenaryRoleId();
  if (mercenaryId) {
    roles.push({ id: mercenaryId, name: '용병', color: '#9ca3af' });
  }
  return roles.filter((r) => r.id);
}

export function getRoleDisplayName(roleId: string): string {
  return getKnownClanRoles().find((r) => r.id === roleId)?.name ?? roleId;
}

/** 클랜원 관리 대상 Discord 역할 ID (운영진 > 열혈 > 클랜원) */
export function getClanRoleIds(): string[] {
  return [getStaffRoleId(), getEnthusiastRoleId(), getMemberRoleId()];
}

export function resolvePrimaryClanRole(memberRoleIds: string[]): string | null {
  for (const id of getClanRoleIds()) {
    if (memberRoleIds.includes(id)) return id;
  }
  return null;
}
