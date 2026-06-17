import { getPositionBalanceScore, type Position } from '@shared/types';

export type BalanceMode = 'kd' | 'position' | 'tier';
export type QuickType = '33' | '44' | '55';

export interface MemberWithStats {
  id: string;
  sudden_nickname: string;
  position: string;
  match_stats: {
    kd: number;
    tier_name: string;
  } | null;
}

export interface ScoredMember extends MemberWithStats {
  score: number;
}

export const QUICK_TEAM_SIZE: Record<QuickType, number> = {
  '33': 3,
  '44': 4,
  '55': 5,
};

export const QUICK_LOBBY_LABEL: Record<QuickType, string> = {
  '33': '3v3',
  '44': '4v4',
  '55': '5v5',
};

const TEAM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function tierScore(tier: string): number {
  const tiers = ['이병', '일병', '상병', '병장', '하사', '중사', '상사', '원사', '준위'];
  const idx = tiers.findIndex((t) => tier.includes(t));
  return idx >= 0 ? idx : 0;
}

export function scoreMember(member: MemberWithStats, mode: BalanceMode): number {
  const stats = member.match_stats;
  switch (mode) {
    case 'kd':
      return stats?.kd ?? 1;
    case 'position':
      return getPositionBalanceScore(member.position);
    case 'tier':
      return tierScore(stats?.tier_name ?? '');
  }
}

export function getTeamLabel(quickIndex: number): string {
  return `${TEAM_LETTERS[quickIndex] ?? quickIndex + 1}팀`;
}

export function getRequiredPlayers(quickType: QuickType, quickCount: number): number {
  return QUICK_TEAM_SIZE[quickType] * quickCount;
}

export function getCompositionHint(
  selectedCount: number,
  quickType: QuickType,
  quickCount: number
): string {
  const required = getRequiredPlayers(quickType, quickCount);
  const label = `${quickType} ${quickCount}퀵`;

  if (selectedCount < required) {
    return `${label} = ${required}명 필요 · 현재 ${selectedCount}명`;
  }

  const excess = selectedCount - required;
  return excess > 0
    ? `${label} = ${required}명 · ${excess}명 대기`
    : `${label} = ${required}명 · 분배 가능`;
}

/** 스네이크 드래프트로 퀵(팀)별 실력 균등 배정 */
function assignTeamsSnake(
  scored: ScoredMember[],
  quickCount: number,
  teamSize: number
): ScoredMember[][] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const teams: ScoredMember[][] = Array.from({ length: quickCount }, () => []);

  for (let i = 0; i < sorted.length && i < quickCount * teamSize; i++) {
    const round = Math.floor(i / quickCount);
    const posInRound = i % quickCount;
    const teamIdx = round % 2 === 0 ? posInRound : quickCount - 1 - posInRound;
    teams[teamIdx].push(sorted[i]);
  }

  return teams;
}

export interface TeamBalanceResult {
  quickType: string;
  quickIndex: number;
  teamLabel: string;
  label: string;
  members: MemberWithStats[];
  totalScore: number;
  composition: string;
}

export interface MultiTeamBalanceResult {
  teams: TeamBalanceResult[];
  reserve: MemberWithStats[];
  planSummary: string;
}

export function balanceQuickTeams(
  members: MemberWithStats[],
  mode: BalanceMode,
  quickType: QuickType,
  quickCount: number
): MultiTeamBalanceResult {
  const teamSize = QUICK_TEAM_SIZE[quickType];
  const required = getRequiredPlayers(quickType, quickCount);

  if (quickCount < 1) {
    throw new Error('퀵 수는 1 이상이어야 합니다.');
  }

  if (members.length < required) {
    throw new Error(
      `${quickType} ${quickCount}퀵은 ${required}명이 필요합니다. (현재 ${members.length}명)`
    );
  }

  const scored = members.map((m) => ({ ...m, score: scoreMember(m, mode) }));
  const teamGroups = assignTeamsSnake(scored, quickCount, teamSize);
  const usedCount = quickCount * teamSize;
  const reserve = scored.slice(usedCount).map(({ score: _, ...m }) => m);

  const teams: TeamBalanceResult[] = teamGroups.map((group, index) => {
    const teamLabel = getTeamLabel(index);
    const totalScore = group.reduce((sum, m) => sum + m.score, 0);

    return {
      quickType,
      quickIndex: index + 1,
      teamLabel,
      label: `${teamLabel} · ${quickType} ${index + 1}퀵`,
      members: group.map(({ score: _, ...m }) => m),
      totalScore: Math.round(totalScore * 100) / 100,
      composition: `${QUICK_LOBBY_LABEL[quickType]} · 타 클랜 매칭`,
    };
  });

  const teamNames = teams.map((t) => t.teamLabel).join(' · ');
  const planSummary =
    reserve.length > 0
      ? `${quickType} ${quickCount}퀵 (${teamNames}) · ${reserve.length}명 대기`
      : `${quickType} ${quickCount}퀵 (${teamNames})`;

  return { teams, reserve, planSummary };
}

/** @deprecated use balanceQuickTeams */
export function balanceQuickLobbies(
  members: MemberWithStats[],
  mode: BalanceMode,
  quickType: QuickType,
  quickCount: number
): MultiTeamBalanceResult {
  return balanceQuickTeams(members, mode, quickType, quickCount);
}
