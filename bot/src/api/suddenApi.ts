import { config } from '../config.js';

const BASE_URL = 'https://open.api.nexon.com';

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const apiKey = config.nexonApiKey;
  if (!apiKey) {
    throw new Error('NEXON_OPEN_API_KEY is not configured');
  }

  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  let retryCount = 0;
  while (true) {
    const res = await fetch(url, {
      headers: { 'x-nxopen-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 429 && retryCount < 3) {
      retryCount++;
      await new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 500));
      continue;
    }

    if (!res.ok) {
      const err = new Error(`Nexon API error: ${res.status}`) as Error & { response?: { status: number } };
      err.response = { status: res.status };
      throw err;
    }

    return (await res.json()) as T;
  }
}

export async function getOuid(nickname: string): Promise<string> {
  const data = await apiFetch<{ ouid: string }>('/suddenattack/v1/id', { user_name: nickname });
  return data.ouid;
}

export async function getBasic(ouid: string) {
  return apiFetch('/suddenattack/v1/user/basic', { ouid });
}

export async function getRank(ouid: string) {
  return apiFetch('/suddenattack/v1/user/rank', { ouid });
}

export async function getTier(ouid: string) {
  return apiFetch('/suddenattack/v1/user/tier', { ouid });
}

export async function getRecentInfo(ouid: string) {
  return apiFetch('/suddenattack/v1/user/recent-info', { ouid });
}

const metaCache: Record<string, unknown> = {};

async function fetchMeta(path: string, key: string) {
  if (metaCache[key]) return metaCache[key];
  try {
    const data = await apiFetch(path);
    metaCache[key] = data;
    return data;
  } catch {
    return null;
  }
}

export const getLogo = () => fetchMeta('/static/suddenattack/meta/logo', 'logo');
export const getGradeImages = () => fetchMeta('/static/suddenattack/meta/grade', 'grade');
export const getSeasonGradeImages = () => fetchMeta('/static/suddenattack/meta/season_grade', 'seasonGrade');
export const getTierImages = () => fetchMeta('/static/suddenattack/meta/tier', 'tier');

export async function preloadMeta() {
  const [logo, grades, seasonGrades, tiers] = await Promise.all([
    getLogo(),
    getGradeImages(),
    getSeasonGradeImages(),
    getTierImages(),
  ]);
  const ok = [logo && 'logo', grades && 'grade', seasonGrades && 'seasonGrade', tiers && 'tier'].filter(Boolean);
  if (ok.length) console.log(`📦 메타 이미지 로드 완료: ${ok.join(', ')}`);
  else console.log('⚠ 메타 이미지 API 접근 불가 (403) — 텍스트 fallback 사용');
  return { logo, grades, seasonGrades, tiers };
}

export function getMetaCache() {
  return metaCache;
}

export async function getMatchList(ouid: string, matchMode = '폭파미션', matchType?: string) {
  const params: Record<string, string> = { ouid, match_mode: matchMode };
  if (matchType) params.match_type = matchType;
  const data = await apiFetch<{ match?: unknown[] }>('/suddenattack/v1/match', params);
  return data.match ?? [];
}

export async function getMatchDetail(matchId: string) {
  return apiFetch('/suddenattack/v1/match-detail', { match_id: matchId });
}

export async function getRecentMatches(
  ouid: string,
  matchMode = '폭파미션',
  matchType?: string,
  count = 20
): Promise<Array<Record<string, unknown>>> {
  const list = (await getMatchList(ouid, matchMode, matchType)) as Array<{ match_id: string }>;
  const recent = list.slice(0, count);

  const details: Array<unknown | null> = new Array(recent.length).fill(null);
  const concurrency = 5;
  let cursor = 0;

  async function worker() {
    while (cursor < recent.length) {
      const i = cursor++;
      const matchId = recent[i].match_id;
      details[i] = await getMatchDetail(matchId).catch(() => null);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, recent.length) }, () => worker()));

  return recent.map((m, i) => ({
    ...m,
    detail: details[i],
  }));
}

export async function getFullProfile(ouid: string): Promise<Record<string, unknown>> {
  const [basic, rank, tier, recentInfo] = await Promise.all([
    getBasic(ouid),
    getRank(ouid),
    getTier(ouid),
    getRecentInfo(ouid),
  ]);
  return {
    ...(basic as Record<string, unknown>),
    ...(rank as Record<string, unknown>),
    ...(tier as Record<string, unknown>),
    ...(recentInfo as Record<string, unknown>),
  };
}
