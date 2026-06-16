'use client';

import type { RecentMatch } from '@shared/types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function kdPercent(kills: number, deaths: number) {
  const total = kills + deaths;
  if (total === 0) return '0%';
  return `${Math.round((kills / total) * 100)}%`;
}

function fmtDamage(damage?: number | null) {
  if (damage == null) return '-';
  return Math.round(damage).toLocaleString('ko-KR');
}

interface MatchRecordCardProps {
  nickname: string;
  matchMode: string;
  matches: RecentMatch[];
}

export function MatchRecordCard({ nickname, matchMode, matches }: MatchRecordCardProps) {
  const count = matches.length;
  const wins = matches.filter((m) => m.result === 'win').length;
  const losses = matches.filter((m) => m.result === 'lose').length;
  const totalKills = matches.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = matches.reduce((s, m) => s + m.deaths, 0);
  const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
  const avgKd =
    totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2);

  return (
    <div className="sa-match-card">
      <header className="sa-match-header">
        <div className="sa-match-header-left">
          <h2 className="sa-match-nickname">{nickname}</h2>
          <p className="sa-match-mode">{matchMode}</p>
        </div>
        <div className="sa-match-header-right">
          <p className="sa-match-record">
            {wins}승 {losses}패
          </p>
          <p className="sa-match-summary">
            승률 {winRate}% | 평균 K/D {avgKd} | {count}경기
          </p>
        </div>
      </header>

      <div className="sa-match-title-row">
        <span className="sa-match-title-bar" />
        <h3 className="sa-match-title">최근 매치 기록</h3>
        <span className="sa-match-count">[{count} MATCHES]</span>
      </div>

      <div className="sa-match-table">
        {matches.map((m, i) => {
          const isWin = m.result === 'win';
          const isDraw = m.result === 'draw';
          const badgeClass = isWin ? 'win' : isDraw ? 'draw' : 'lose';
          const badgeText = isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSE';

          return (
            <div key={m.match_id || i} className={`sa-match-row ${i % 2 === 1 ? 'alt' : ''}`}>
              <span className={`sa-match-side ${badgeClass}`} />
              <div className={`sa-match-badge ${badgeClass}`}>{badgeText}</div>

              <div className="sa-match-map">
                <span className="sa-match-map-name">{m.map_name || '-'}</span>
                <span className="sa-match-time">{timeAgo(m.played_at)}</span>
              </div>

              <div className="sa-match-stat">
                <span className="sa-match-stat-value">{m.kills}</span>
                <span className="sa-match-stat-label">KILLS</span>
              </div>

              <div className="sa-match-stat deaths">
                <span className="sa-match-stat-value">{m.deaths}</span>
                <span className="sa-match-stat-label">DEATHS</span>
              </div>

              <div className="sa-match-stat">
                <span className="sa-match-stat-value">{m.assists ?? 0}</span>
                <span className="sa-match-stat-label">ASSISTS</span>
              </div>

              <div className="sa-match-stat kd">
                <span className="sa-match-stat-value">{kdPercent(m.kills, m.deaths)}</span>
                <span className="sa-match-stat-label">K/D</span>
              </div>

              <div className="sa-match-stat">
                <span className="sa-match-stat-value">{fmtDamage(m.damage)}</span>
                <span className="sa-match-stat-label">DAMAGE</span>
              </div>

              <span className="sa-match-type">{m.match_type || '-'}</span>
            </div>
          );
        })}
      </div>

      <footer className="sa-match-footer">Powered by Nexon Open API · Cranky Bot</footer>
    </div>
  );
}
