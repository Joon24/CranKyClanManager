'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MatchRecordCard } from '@/components/MatchRecordCard';
import { SuspicionBadge } from '@/components/SuspicionBadge';
import type { RecentMatch, SuspicionLevel } from '@shared/types';

interface StatsResult {
  nickname: string;
  matchMode: string;
  displayKd: number;
  displayWinRate: number;
  rankName: string;
  tierName: string;
  displayMatches: RecentMatch[];
  suspicion: { score: number; level: SuspicionLevel; reasons: string[] };
  disclaimer: string;
  matchSampleSize?: number;
  syncedMember?: { nickname: string; userId: string } | null;
}

export default function StatsPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<StatsResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/stats/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '조회 실패');
        return;
      }
      setResult(data);
    } catch {
      setError('전적 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    if (q) runSearch(q);
  }, [searchParams, runSearch]);

  return (
    <div className="stats-page">
      <header className="stats-hero">
        <div className="stats-hero-text">
          <p className="dash-hero-badge">Match Stats</p>
          <h1 className="dash-hero-title">전적 조회</h1>
          <p className="dash-hero-sub">Nexon Open API · 최근 매치 기록 · 의심지표</p>
        </div>
        <div className="stats-search-box">
          <span className="stats-search-icon">🔍</span>
          <input
            className="stats-search-input"
            placeholder="서든어택 닉네임 또는 OUID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
          />
          <button
            className="stats-search-btn"
            onClick={() => runSearch(query)}
            disabled={loading || !query.trim()}
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>
      </header>

      {error && (
        <div className="stats-error">
          <span>❌</span> {error}
        </div>
      )}

      {loading && (
        <div className="stats-loading">
          <div className="app-spinner" />
          <p>전적 데이터를 불러오는 중...</p>
        </div>
      )}

      {!loading && !result && !error && (
        <div className="stats-empty">
          <div className="stats-empty-icon">🎮</div>
          <h3>닉네임을 입력해 전적을 조회하세요</h3>
          <p>클랜원 닉네임 조회 시 클랜원 관리에 자동 반영됩니다.</p>
        </div>
      )}

      {result && !loading && (
        <div className="stats-result">
          {result.syncedMember && (
            <div className="stats-sync-banner">
              ✅ <strong>{result.syncedMember.nickname}</strong>님의 전적이 클랜원 관리에
              반영되었습니다 (최근 {result.matchSampleSize ?? 20}판)
            </div>
          )}

          <MatchRecordCard
            nickname={result.nickname}
            matchMode={result.matchMode}
            matches={result.displayMatches}
          />

          <div className="stats-admin-panel">
            <div className="stats-admin-meta">
              <span>{result.rankName}</span>
              <span>·</span>
              <span>{result.tierName}</span>
              <span>·</span>
              <span>KD {result.displayKd}</span>
              <span>·</span>
              <span>승률 {result.displayWinRate}% (최근 20경기)</span>
            </div>
            <div className="stats-suspicion-inline">
              <span className="stats-suspicion-label">의심 지표</span>
              <SuspicionBadge level={result.suspicion.level} />
              <span className="stats-score-text">점수 {result.suspicion.score}/100</span>
            </div>
            {result.suspicion.reasons.length > 0 && (
              <ul className="stats-reasons-compact">
                {result.suspicion.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          <p className="stats-disclaimer">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
