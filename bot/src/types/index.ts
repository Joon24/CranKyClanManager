export type Position = 'S' | 'R' | 'M' | 'T';

const CLAN_NICKNAME_PREFIX = '까칠한';

function stripClanPrefixFromNickname(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith(CLAN_NICKNAME_PREFIX)) {
    const rest = trimmed.slice(CLAN_NICKNAME_PREFIX.length).trim();
    return rest || trimmed;
  }

  const ckMatch = trimmed.match(/^CK(.+)$/i);
  if (ckMatch?.[1]) {
    const rest = ckMatch[1].trim();
    return rest || trimmed;
  }

  return trimmed;
}

export function normalizeSuddenNicknameForServer(suddenNickname: string): string {
  return stripClanPrefixFromNickname(suddenNickname);
}

export function buildServerNickname(suddenNickname: string, position: Position, age: number): string {
  const base = normalizeSuddenNicknameForServer(suddenNickname);
  return `${base}${position}/${age}`;
}

/** 용병 서버 별명: 초대한 지인 닉 + 인맥 (예: 랜딩 → 랜딩인맥) */
export function buildMercenaryServerNickname(inviterNickname: string): string {
  const base = normalizeSuddenNicknameForServer(inviterNickname);
  return `${base}인맥`;
}

/** 서버 별명에서 기본 닉 추출 (S/30, 인맥 접미사·클랜 접두어 제거) */
export function extractNicknameBase(serverNickname: string): string {
  const withoutSuffix = serverNickname.replace(/[SRTM]\/\d+$/, '').replace(/인맥$/, '').trim();
  return stripClanPrefixFromNickname(withoutSuffix);
}

export interface ApplicationFormData {
  suddenNickname: string;
  age: number;
  position: Position;
  mainTime: string;
  previousClan: string;
  joinSource: string;
}
