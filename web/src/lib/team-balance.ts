import { getPositionBalanceScore, type Position } from '@shared/types';

export type BalanceMode = 'kd' | 'position' | 'tier';
export type QuickSize = 6 | 8 | 10;

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

export interface CompositionRule {
  label: string;
  perTeam: {
    fixed: Partial<Record<Position, number>>;
    flex?: { from: Position[]; count: number };
  };
}

export const QUICK_TYPE_LABEL: Record<QuickSize, string> = {
  6: '33',
  8: '44',
  10: '55',
};

export const TEAM_COMPOSITION_RULES: Record<QuickSize, CompositionRule> = {
  6: {
    label: '3v3 — 팀당 S 1 + R/M/T 2',
    perTeam: { fixed: { S: 1 }, flex: { from: ['R', 'M', 'T'], count: 2 } },
  },
  8: {
    label: '4v4 — 팀당 S 1 · M 1 + R/T 2',
    perTeam: { fixed: { S: 1, M: 1 }, flex: { from: ['R', 'T'], count: 2 } },
  },
  10: {
    label: '5v5 — 팀당 S 2 + R/M/T 3',
    perTeam: { fixed: { S: 2 }, flex: { from: ['R', 'M', 'T'], count: 3 } },
  },
};

const POSITIONS: Position[] = ['S', 'R', 'M', 'T'];
const LOBBY_SIZES: QuickSize[] = [6, 8, 10];

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

function countByPosition(members: MemberWithStats[]): Record<Position, number> {
  const counts: Record<Position, number> = { S: 0, R: 0, M: 0, T: 0 };
  for (const m of members) {
    const pos = m.position as Position;
    if (pos in counts) counts[pos]++;
  }
  return counts;
}

function validateGlobalForLobbies(members: MemberWithStats[], sizes: QuickSize[]): string | null {
  if (sizes.length === 0) {
    return '최소 6명(33 퀵 1판) 이상 필요합니다.';
  }

  const pools = countByPosition(members);
  const order = [...sizes].sort((a, b) => b - a);

  for (const size of order) {
    const rule = TEAM_COMPOSITION_RULES[size];
    const label = `${QUICK_TYPE_LABEL[size]} 퀵`;

    for (const pos of POSITIONS) {
      const need = (rule.perTeam.fixed[pos] ?? 0) * 2;
      if (need > 0 && pools[pos] < need) {
        const name = { S: '스나', R: '라플', M: '멀티', T: '특총' }[pos];
        return `${label} 구성에 ${name}(${pos})가 부족합니다. (필요 ${need}명 · 남은 ${pools[pos]}명)`;
      }
      pools[pos] -= need;
    }

    if (rule.perTeam.flex) {
      const need = rule.perTeam.flex.count * 2;
      let left = need;
      while (left > 0) {
        let pick: Position | null = null;
        let pickCount = -1;
        for (const pos of rule.perTeam.flex.from) {
          if (pools[pos] > pickCount) {
            pickCount = pools[pos];
            pick = pos;
          }
        }
        if (!pick || pickCount <= 0) {
          return `${label} 구성에 ${rule.perTeam.flex.from.join('/')} 포지션이 부족합니다. (필요 ${need}명)`;
        }
        pools[pick]--;
        left--;
      }
    }
  }

  return null;
}
export function planQuickLobbies(total: number): { sizes: QuickSize[]; reserve: number } {
  if (total < 6) {
    return { sizes: [], reserve: total };
  }

  let bestUsed = -1;
  let bestSizes: QuickSize[] = [];

  function dfs(remaining: number, sizes: QuickSize[]) {
    const used = total - remaining;
    if (used > bestUsed) {
      bestUsed = used;
      bestSizes = [...sizes];
    }

    for (const size of LOBBY_SIZES) {
      if (size <= remaining) {
        dfs(remaining - size, [...sizes, size]);
      }
    }
  }

  dfs(total, []);
  bestSizes.sort((a, b) => b - a);

  return {
    sizes: bestSizes,
    reserve: total - bestSizes.reduce((sum, s) => sum + s, 0),
  };
}

export function getCompositionHint(count: number): string | null {
  const { sizes, reserve } = planQuickLobbies(count);
  if (sizes.length === 0) return null;

  const parts = countQuickLabels(sizes);
  const plan = parts.map((p) => `${p.label} ${p.count}판`).join(' · ');
  return reserve > 0 ? `${plan} · ${reserve}명 대기` : plan;
}

function countQuickLabels(sizes: QuickSize[]) {
  const counts: Record<string, number> = {};
  for (const size of sizes) {
    const label = `${QUICK_TYPE_LABEL[size]} 퀵`;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.entries(counts).map(([label, count]) => ({ label, count }));
}

export function validateTeamComposition(members: MemberWithStats[]): string | null {
  const count = members.length as QuickSize;

  if (count % 2 !== 0) {
    return '한 판당 짝수 명수만 팀 나눌 수 있습니다.';
  }

  const rule = TEAM_COMPOSITION_RULES[count];
  if (!rule) {
    return `포지션 구성 규칙은 6명(33), 8명(44), 10명(55)만 지원합니다. (현재 ${count}명)`;
  }

  return validateCompositionRule(members, rule);
}

function validateCompositionRule(members: MemberWithStats[], rule: CompositionRule): string | null {
  const byPos = countByPosition(members);
  const teams = 2;

  for (const pos of POSITIONS) {
    const perTeam = rule.perTeam.fixed[pos] ?? 0;
    if (perTeam === 0) continue;
    const required = perTeam * teams;
    const have = byPos[pos];
    if (have !== required) {
      const name = { S: '스나', R: '라플', M: '멀티', T: '특총' }[pos];
      return `${name}(${pos})는 ${required}명이어야 합니다. (현재 ${have}명)`;
    }
  }

  if (rule.perTeam.flex) {
    const flexRequired = rule.perTeam.flex.count * teams;
    const flexHave = rule.perTeam.flex.from.reduce((sum, p) => sum + byPos[p], 0);
    if (flexHave !== flexRequired) {
      return `${rule.perTeam.flex.from.join('/')} 포지션은 총 ${flexRequired}명이어야 합니다. (현재 ${flexHave}명)`;
    }
  }

  return null;
}

function assignGreedy(
  pool: ScoredMember[],
  teamA: ScoredMember[],
  teamB: ScoredMember[],
  totals: { a: number; b: number },
  perTeam: number
) {
  const sorted = [...pool].sort((a, b) => b.score - a.score);
  let aCount = 0;
  let bCount = 0;

  for (const member of sorted) {
    if (aCount >= perTeam && bCount >= perTeam) break;

    if (aCount >= perTeam) {
      teamB.push(member);
      totals.b += member.score;
      bCount++;
    } else if (bCount >= perTeam) {
      teamA.push(member);
      totals.a += member.score;
      aCount++;
    } else if (totals.a <= totals.b) {
      teamA.push(member);
      totals.a += member.score;
      aCount++;
    } else {
      teamB.push(member);
      totals.b += member.score;
      bCount++;
    }
  }
}

function takeFromPool(pool: ScoredMember[], count: number): ScoredMember[] {
  pool.sort((a, b) => b.score - a.score);
  return pool.splice(0, count);
}

function takeFlexFromPools(
  pools: Record<Position, ScoredMember[]>,
  from: Position[],
  count: number
): ScoredMember[] {
  const taken: ScoredMember[] = [];
  for (let i = 0; i < count; i++) {
    let bestPos: Position | null = null;
    let bestScore = -Infinity;
    for (const p of from) {
      if (pools[p].length === 0) continue;
      pools[p].sort((a, b) => b.score - a.score);
      const top = pools[p][0];
      if (top.score > bestScore) {
        bestScore = top.score;
        bestPos = p;
      }
    }
    if (!bestPos) break;
    taken.push(pools[bestPos].shift()!);
  }
  return taken;
}

function assignMembersToLobbies(
  scored: ScoredMember[],
  sizes: QuickSize[]
): { lobbyMembers: ScoredMember[][]; reserve: ScoredMember[] } {
  const pools: Record<Position, ScoredMember[]> = { S: [], R: [], M: [], T: [] };
  const unknown: ScoredMember[] = [];

  for (const m of scored) {
    const pos = m.position as Position;
    if (pos in pools) pools[pos].push(m);
    else unknown.push(m);
  }

  const lobbyMembers: ScoredMember[][] = sizes.map(() => []);
  const order = sizes
    .map((size, index) => ({ size, index }))
    .sort((a, b) => b.size - a.size);

  for (const { size, index } of order) {
    const rule = TEAM_COMPOSITION_RULES[size];
    const lobby = lobbyMembers[index];

    for (const pos of POSITIONS) {
      const need = (rule.perTeam.fixed[pos] ?? 0) * 2;
      lobby.push(...takeFromPool(pools[pos], need));
    }

    if (rule.perTeam.flex) {
      const need = rule.perTeam.flex.count * 2;
      lobby.push(...takeFlexFromPools(pools, rule.perTeam.flex.from, need));
    }
  }

  const reserve = [
    ...unknown,
    ...POSITIONS.flatMap((p) => pools[p]),
  ].sort((a, b) => b.score - a.score);

  return { lobbyMembers, reserve };
}

export function balanceTeamsWithComposition(members: MemberWithStats[], mode: BalanceMode) {
  const compositionError = validateTeamComposition(members);
  if (compositionError) {
    throw new Error(compositionError);
  }

  const rule = TEAM_COMPOSITION_RULES[members.length as QuickSize];
  const scored = members.map((m) => ({ ...m, score: scoreMember(m, mode) }));

  return balanceSingleLobby(scored, rule);
}

function balanceSingleLobby(scored: ScoredMember[], rule: CompositionRule) {
  const byPos: Record<Position, ScoredMember[]> = { S: [], R: [], M: [], T: [] };

  for (const m of scored) {
    const pos = m.position as Position;
    if (pos in byPos) byPos[pos].push(m);
  }

  const teamA: ScoredMember[] = [];
  const teamB: ScoredMember[] = [];
  const totals = { a: 0, b: 0 };

  for (const pos of POSITIONS) {
    const needPerTeam = rule.perTeam.fixed[pos] ?? 0;
    if (needPerTeam === 0) continue;
    assignGreedy(byPos[pos], teamA, teamB, totals, needPerTeam);
  }

  if (rule.perTeam.flex) {
    const flexPool = rule.perTeam.flex.from.flatMap((p) => byPos[p]);
    assignGreedy(flexPool, teamA, teamB, totals, rule.perTeam.flex.count);
  }

  return {
    teamA: teamA.map(({ score: _, ...m }) => m),
    teamB: teamB.map(({ score: _, ...m }) => m),
    totalA: Math.round(totals.a * 100) / 100,
    totalB: Math.round(totals.b * 100) / 100,
    composition: rule.label,
  };
}

export interface LobbyBalanceResult {
  quickType: string;
  label: string;
  teamA: MemberWithStats[];
  teamB: MemberWithStats[];
  totalA: number;
  totalB: number;
  composition: string;
}

export interface MultiLobbyBalanceResult {
  lobbies: LobbyBalanceResult[];
  reserve: MemberWithStats[];
  planSummary: string;
}

export function balanceQuickLobbies(
  members: MemberWithStats[],
  mode: BalanceMode
): MultiLobbyBalanceResult {
  const { sizes, reserve: reserveCount } = planQuickLobbies(members.length);
  const globalError = validateGlobalForLobbies(members, sizes);
  if (globalError) {
    throw new Error(globalError);
  }

  const scored = members.map((m) => ({ ...m, score: scoreMember(m, mode) }));
  const { lobbyMembers, reserve } = assignMembersToLobbies(scored, sizes);

  const typeCounters: Record<string, number> = {};
  const lobbies: LobbyBalanceResult[] = [];

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const quickType = QUICK_TYPE_LABEL[size];
    typeCounters[quickType] = (typeCounters[quickType] ?? 0) + 1;
    const label = `${quickType} 퀵 #${typeCounters[quickType]}`;

    const lobbyError = validateTeamComposition(
      lobbyMembers[i].map(({ score: _, ...m }) => m)
    );
    if (lobbyError) {
      throw new Error(`${label}: ${lobbyError}`);
    }

    const balanced = balanceSingleLobby(lobbyMembers[i], TEAM_COMPOSITION_RULES[size]);
    lobbies.push({
      quickType,
      label,
      ...balanced,
    });
  }

  const planParts = countQuickLabels(sizes)
    .map((p) => `${p.label} ${p.count}판`)
    .join(' · ');
  const planSummary =
    reserveCount > 0
      ? `${planParts} · ${reserveCount}명 대기`
      : planParts;

  return {
    lobbies,
    reserve: reserve.map(({ score: _, ...m }) => m),
    planSummary,
  };
}
