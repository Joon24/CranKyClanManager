import type { RecentMatch } from '@shared/types';
import { stripClanPrefixFromNickname } from '@shared/types';

/** 의심지표·KD·승률 계산에 사용하는 최근 경기 수 */
export const MATCH_SAMPLE_SIZE = 20;
/** UI 카드에 표시할 최근 경기 수 */
export const MATCH_DISPLAY_SIZE = 10;

export interface NexonMatchStats {
  ouid: string;
  nickname: string;
  matchMode: string;
  /** 최근 20판 — 의심지표 계산용 */
  kd: number;
  winRate: number;
  avgKills: number;
  /** 최근 10경기 — 전적 카드·클랜원 관리 표시용 */
  displayKd: number;
  displayWinRate: number;
  rankName: string;
  tierName: string;
  recentMatches: RecentMatch[];
  displayMatches: RecentMatch[];
}

const BASE_URL = 'https://open.api.nexon.com';

function apiHeaders() {
  const apiKey = process.env.NEXON_OPEN_API_KEY;
  if (!apiKey) return null;
  return { 'x-nxopen-api-key': apiKey };
}

async function nexonGet<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const headers = apiHeaders();
  if (!headers) return null;

  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { headers, cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function fetchOuid(nickname: string): Promise<string | null> {
  const trimmed = nickname.trim();
  const candidates = [trimmed];

  const withoutPrefix = stripClanPrefixFromNickname(trimmed);
  if (withoutPrefix && withoutPrefix !== trimmed) {
    candidates.push(withoutPrefix);
  }

  const seen = new Set<string>();
  for (const name of candidates) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const data = await nexonGet<{ ouid?: string }>('/suddenattack/v1/id', { user_name: name });
    if (data?.ouid) return data.ouid;
  }

  return null;
}

interface MatchListItem {
  match_id: string;
  match_result?: string;
  kill?: number;
  death?: number;
  assist?: number;
  date_match?: string;
  match_type?: string;
}

interface MatchDetailResponse {
  match_map?: string;
  match_detail?: Array<{ user_name?: string; damage?: number }>;
}

async function fetchMatchDetail(matchId: string): Promise<MatchDetailResponse | null> {
  return nexonGet<MatchDetailResponse>('/suddenattack/v1/match-detail', { match_id: matchId });
}

async function fetchMatchDetailsConcurrent(
  matchIds: string[],
  concurrency = 5
): Promise<Array<MatchDetailResponse | null>> {
  const results: Array<MatchDetailResponse | null> = new Array(matchIds.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < matchIds.length) {
      const i = cursor++;
      results[i] = await fetchMatchDetail(matchIds[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, matchIds.length) }, () => worker())
  );
  return results;
}

function parseResult(matchResult?: string): 'win' | 'lose' | 'draw' {
  if (matchResult === '1') return 'win';
  if (matchResult === '2') return 'lose';
  return 'draw';
}

function buildMatchRow(match: MatchListItem): RecentMatch {
  return {
    match_id: match.match_id,
    result: parseResult(match.match_result),
    kills: match.kill ?? 0,
    deaths: match.death ?? 0,
    assists: match.assist ?? 0,
    match_type: match.match_type,
    played_at: match.date_match ?? new Date().toISOString(),
  };
}

function summarizeMatches(rows: RecentMatch[]) {
  let totalKills = 0;
  let totalDeaths = 0;
  let wins = 0;

  for (const row of rows) {
    totalKills += row.kills;
    totalDeaths += row.deaths;
    if (row.result === 'win') wins++;
  }

  const count = rows.length;
  const kd = count > 0 ? (totalDeaths > 0 ? totalKills / totalDeaths : totalKills) : 0;
  const winRate = count > 0 ? (wins / count) * 100 : 0;
  const avgKills = count > 0 ? totalKills / count : 0;

  return {
    kd: Math.round(kd * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    avgKills: Math.round(avgKills * 100) / 100,
  };
}

async function enrichWithDetails(
  matches: RecentMatch[],
  listItems: MatchListItem[],
  apiUserName: string
): Promise<RecentMatch[]> {
  const ids = listItems.slice(0, MATCH_DISPLAY_SIZE).map((m) => m.match_id);
  const details = await fetchMatchDetailsConcurrent(ids);

  return matches.slice(0, MATCH_DISPLAY_SIZE).map((row, i) => {
    const detail = details[i];
    const source = listItems[i];
    const me = detail?.match_detail?.find((p) => p.user_name === apiUserName);
    return {
      ...row,
      assists: source?.assist ?? row.assists ?? 0,
      match_type: source?.match_type ?? row.match_type,
      map_name: detail?.match_map ?? row.map_name,
      damage: me?.damage ?? row.damage ?? null,
    };
  });
}

export async function fetchMatchStats(
  ouid: string,
  searchNickname?: string
): Promise<NexonMatchStats | null> {
  if (!apiHeaders()) return null;

  const matchMode = '폭파미션';

  const [basicData, rankData, tierData, matchData] = await Promise.all([
    nexonGet<{ user_name?: string }>('/suddenattack/v1/user/basic', { ouid }),
    nexonGet<{
      grade?: string;
      season_grade?: string;
    }>('/suddenattack/v1/user/rank', { ouid }),
    nexonGet<{
      solo_rank_match_tier?: string;
      party_rank_match_tier?: string;
    }>('/suddenattack/v1/user/tier', { ouid }),
    nexonGet<{ match?: MatchListItem[] }>('/suddenattack/v1/match', {
      ouid,
      match_mode: matchMode,
    }),
  ]);

  const apiUserName = basicData?.user_name ?? searchNickname ?? ouid;
  const rankName = rankData?.grade ?? rankData?.season_grade ?? '알 수 없음';
  const tierName =
    tierData?.solo_rank_match_tier ??
    tierData?.party_rank_match_tier ??
    rankData?.season_grade ??
    '알 수 없음';

  const matchList = matchData?.match ?? [];
  const recentMatches: RecentMatch[] = [];

  for (const match of matchList.slice(0, MATCH_SAMPLE_SIZE)) {
    recentMatches.push(buildMatchRow(match));
  }

  const displayMatches = await enrichWithDetails(recentMatches, matchList, apiUserName);

  const sampleSummary = summarizeMatches(recentMatches);
  const displaySummary = summarizeMatches(displayMatches);

  return {
    ouid,
    nickname: apiUserName,
    matchMode,
    kd: sampleSummary.kd,
    winRate: sampleSummary.winRate,
    avgKills: sampleSummary.avgKills,
    displayKd: displaySummary.kd,
    displayWinRate: displaySummary.winRate,
    rankName,
    tierName,
    recentMatches,
    displayMatches,
  };
}
