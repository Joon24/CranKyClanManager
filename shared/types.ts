export type UserStatus = 'pending' | 'approved' | 'rejected' | 'blocked' | 'left' | 'kicked';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'on_hold' | 'blocked';
export type ApiCheckStatus = 'pending' | 'success' | 'failed' | 'not_found';
export type SuspicionLevel = 'normal' | 'caution' | 'review';
export type Position = 'S' | 'R' | 'M' | 'T';

export const POSITIONS = ['S', 'R', 'M', 'T'] as const satisfies readonly Position[];

export const POSITION_META: Record<
  Position,
  { short: string; name: string; color: string; balanceScore: number }
> = {
  S: { short: 'S', name: '스나', color: '#ef4444', balanceScore: 4 },
  R: { short: 'R', name: '라플', color: '#3b82f6', balanceScore: 2 },
  M: { short: 'M', name: '멀티', color: '#a855f7', balanceScore: 1 },
  T: { short: 'T', name: '특총', color: '#f59e0b', balanceScore: 3 },
};

export function getPositionBalanceScore(position: string): number {
  if (position in POSITION_META) {
    return POSITION_META[position as Position].balanceScore;
  }
  return 1;
}

export type MemberType = 'member' | 'mercenary';

export interface User {
  id: string;
  discord_user_id: string;
  discord_username: string;
  sudden_nickname: string | null;
  ouid: string | null;
  age: number | null;
  position: Position | null;
  server_nickname: string | null;
  role: string;
  member_type: MemberType;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  discord_user_id: string;
  sudden_nickname: string;
  age: number;
  position: Position;
  main_time: string;
  previous_clan: string | null;
  join_source: string;
  api_check_status: ApiCheckStatus;
  admin_memo: string | null;
  status: ApplicationStatus;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface MatchStats {
  id: string;
  user_id: string;
  ouid: string;
  kd: number | null;
  win_rate: number | null;
  rank_name: string | null;
  tier_name: string | null;
  recent_matches: RecentMatch[];
  suspicion_score: number;
  suspicion_level: SuspicionLevel;
  last_checked_at: string;
}

export interface RecentMatch {
  match_id: string;
  result: 'win' | 'lose' | 'draw';
  kills: number;
  deaths: number;
  assists?: number;
  damage?: number | null;
  map_name?: string;
  match_type?: string;
  played_at: string;
}

export interface Warning {
  id: string;
  user_id: string;
  warning_type: string;
  reason: string;
  point: number;
  created_by: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

/** 서든어택 풀네임 클랜 접두어 (서버 별명·조회 시 제외) */
export const CLAN_NICKNAME_PREFIX = '까칠한';
export const CLAN_NICKNAME_PREFIX_ALT = 'CK';

/** 서든 풀네임에서 클랜 접두어(까칠한, CK) 제거 */
export function stripClanPrefixFromNickname(name: string): string {
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

export function buildMercenaryServerNickname(inviterNickname: string): string {
  const base = normalizeSuddenNicknameForServer(inviterNickname);
  return `${base}인맥`;
}

/** 서버 별명 파싱 (예: 랜딩M/30 → base, position, age) */
export function parseServerNickname(serverNickname: string): {
  base: string;
  position: Position | null;
  age: number | null;
} {
  const trimmed = serverNickname.trim();
  const match = trimmed.match(/^(.+?)([SRTM])\/(\d+)$/);
  if (match) {
    return {
      base: stripClanPrefixFromNickname(match[1].trim()),
      position: match[2] as Position,
      age: parseInt(match[3], 10),
    };
  }
  if (trimmed.endsWith('인맥')) {
    return {
      base: stripClanPrefixFromNickname(trimmed.replace(/인맥$/, '').trim()),
      position: null,
      age: null,
    };
  }
  return { base: stripClanPrefixFromNickname(trimmed), position: null, age: null };
}

/** 서버 별명 base → 서든 풀네임 (Nexon API 조회용) */
export function guessSuddenNickname(base: string): string {
  const core = stripClanPrefixFromNickname(base);
  if (!core) return base.trim();
  return `${CLAN_NICKNAME_PREFIX}${core}`;
}

/** Discord 동기화 시 Discord 유저명으로 잘못 추정된 닉네임인지 */
export function isAutoGuessedSuddenNickname(
  suddenNickname: string | null | undefined,
  discordUsername: string
): boolean {
  if (!suddenNickname?.trim()) return false;
  const sn = suddenNickname.trim();
  const user = discordUsername.trim();
  if (!user) return false;
  return (
    sn === guessSuddenNickname(user) ||
    sn === `${CLAN_NICKNAME_PREFIX}${user}` ||
    sn.toLowerCase() === `ck${user}`.toLowerCase()
  );
}

export function buildSuddenNicknameFromServer(serverNickname: string): string | null {
  const parsed = parseServerNickname(serverNickname);
  if (!parsed.position || parsed.age == null) return null;
  if (!parsed.base) return null;
  return guessSuddenNickname(parsed.base);
}

export const SUSPICION_LABELS: Record<SuspicionLevel, { emoji: string; label: string }> = {
  normal: { emoji: '🟢', label: '정상' },
  caution: { emoji: '🟡', label: '주의' },
  review: { emoji: '🔴', label: '검토 필요' },
};
