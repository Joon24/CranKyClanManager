import type { RecentMatch, SuspicionLevel } from '@shared/types';
import type { NexonMatchStats } from './nexon';
import { MATCH_SAMPLE_SIZE } from './nexon';

interface SuspicionResult {
  score: number;
  level: SuspicionLevel;
  reasons: string[];
}

/**
 * 최근 20판 기준 참고용 의심 지표 (공식 제재 아님)
 */
export function calculateSuspicion(stats: NexonMatchStats): SuspicionResult {
  let score = 0;
  const reasons: string[] = [];
  const matches = stats.recentMatches.slice(0, MATCH_SAMPLE_SIZE);

  if (matches.length < 5) {
    return {
      score: 0,
      level: 'normal',
      reasons: [`최근 ${matches.length}판 — 5판 이상 필요`],
    };
  }

  if (stats.kd >= 3.5) {
    score += 30;
    reasons.push(`최근 ${matches.length}판 KD 비정상 상승`);
  } else if (stats.kd >= 2.5) {
    score += 15;
    reasons.push(`최근 ${matches.length}판 KD 상승 추세`);
  }

  if (stats.winRate >= 80) {
    score += 25;
    reasons.push(`최근 ${matches.length}판 승률 과도하게 높음`);
  } else if (stats.winRate >= 65) {
    score += 10;
    reasons.push(`최근 ${matches.length}판 승률 높음`);
  }

  if (stats.avgKills >= 25) {
    score += 20;
    reasons.push(`최근 ${matches.length}판 평균 킬 수 비정상`);
  } else if (stats.avgKills >= 18) {
    score += 10;
    reasons.push(`최근 ${matches.length}판 평균 킬 수 높음`);
  }

  if (matches.length >= 10) {
    const firstHalf = matches.slice(0, Math.floor(matches.length / 2));
    const secondHalf = matches.slice(Math.floor(matches.length / 2));
    const firstKd = avgKd(firstHalf);
    const secondKd = avgKd(secondHalf);

    if (secondKd - firstKd >= 1.5) {
      score += 20;
      reasons.push('최근 20판 내 전적 급변');
    }
  }

  if (isNewAccountHighSpec(stats)) {
    score += 15;
    reasons.push('신규 계정 고스펙 패턴');
  }

  let level: SuspicionLevel = 'normal';
  if (score >= 50) level = 'review';
  else if (score >= 25) level = 'caution';

  const displayReasons =
    level === 'normal' && reasons.length === 1 && reasons[0].includes('5판 이상')
      ? []
      : reasons.filter((r) => !r.includes('5판 이상'));

  return { score, level, reasons: displayReasons };
}

function avgKd(matches: RecentMatch[]): number {
  const kills = matches.reduce((s, m) => s + m.kills, 0);
  const deaths = matches.reduce((s, m) => s + m.deaths, 0);
  return deaths > 0 ? kills / deaths : kills;
}

function isNewAccountHighSpec(stats: NexonMatchStats): boolean {
  const lowTier = ['이병', '일병', '상병'].some((t) => stats.rankName.includes(t));
  return lowTier && stats.kd >= 2.0 && stats.winRate >= 60;
}
