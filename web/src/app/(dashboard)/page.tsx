'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';

interface DashboardData {
  totalMembers: number;
  pendingApps: number;
  todayJoins: number;
  warningUsers: number;
  reviewTargets: number;
  positionCount: { S: number; R: number; M: number; T: number; other: number };
  joinTrend: { label: string; count: number }[];
  maxTrend: number;
  recentLogs: {
    id: string;
    action: string;
    description: string;
    created_by: string | null;
    created_at: string;
    users: { sudden_nickname: string } | null;
  }[];
  pendingList: {
    id: string;
    sudden_nickname: string;
    position: string;
    age: number;
    created_at: string;
  }[];
}

const STAT_CARDS = [
  { key: 'totalMembers' as const, label: '총 인원', icon: '👥', accent: '#3b82f6', glow: 'rgba(59,130,246,0.25)' },
  { key: 'pendingApps' as const, label: '승인 대기', icon: '⏳', accent: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  { key: 'todayJoins' as const, label: '오늘 가입', icon: '✨', accent: '#22c55e', glow: 'rgba(34,197,94,0.25)' },
  { key: 'warningUsers' as const, label: '경고 누적', icon: '⚠️', accent: '#eab308', glow: 'rgba(234,179,8,0.25)' },
  { key: 'reviewTargets' as const, label: '검토 대상', icon: '🔍', accent: '#ef4444', glow: 'rgba(239,68,68,0.25)' },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const totalPos =
    (data?.positionCount.S ?? 0) +
    (data?.positionCount.R ?? 0) +
    (data?.positionCount.M ?? 0) +
    (data?.positionCount.T ?? 0) +
    (data?.positionCount.other ?? 0);

  return (
    <div className="대시보드">
      <header className="dash-hero">
        <div className="dash-hero-content">
          <p className="dash-hero-badge">CranKy Clan Manager</p>
          <h1 className="dash-hero-title">관리자 대시보드</h1>
          <p className="dash-hero-sub">
            클랜 가입 · 승인 · 전적 · 활동을 한눈에 관리하세요
          </p>
        </div>
        <div className="dash-hero-actions">
          <Link href="/applications" className="dash-btn dash-btn-primary">
            가입 신청 {data?.pendingApps ? `(${data.pendingApps})` : ''}
          </Link>
          <Link href="/members" className="dash-btn dash-btn-ghost">
            클랜원 관리
          </Link>
        </div>
      </header>

      <section className="dash-stats">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="dash-stat-card"
            style={{ '--accent': card.accent, '--glow': card.glow } as CSSProperties}
          >
            <div className="dash-stat-icon">{card.icon}</div>
            <div className="dash-stat-body">
              <span className="dash-stat-label">{card.label}</span>
              <span className="dash-stat-value">
                {loading ? '—' : (data?.[card.key] ?? 0)}
              </span>
            </div>
            {card.key === 'pendingApps' && (data?.pendingApps ?? 0) > 0 && (
              <span className="dash-pulse" />
            )}
          </div>
        ))}
      </section>

      <div className="dash-grid">
        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>📈 최근 7일 가입 추이</h2>
          </div>
          <div className="dash-chart">
            {(data?.joinTrend ?? []).map((bar) => (
              <div key={bar.label} className="dash-chart-col">
                <div className="dash-chart-bar-wrap">
                  <div
                    className="dash-chart-bar"
                    style={{
                      height: `${((bar.count / (data?.maxTrend || 1)) * 100).toFixed(0)}%`,
                    }}
                  >
                    <span className="dash-chart-count">{bar.count}</span>
                  </div>
                </div>
                <span className="dash-chart-label">{bar.label}</span>
              </div>
            ))}
            {loading && <p className="dash-loading">불러오는 중...</p>}
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>🎯 포지션 분포</h2>
          </div>
          <div className="dash-positions">
            {[
              { key: 'S', label: 'Sniper', color: '#ef4444' },
              { key: 'R', label: 'Rifle', color: '#3b82f6' },
              { key: 'M', label: 'Multi', color: '#a855f7' },
              { key: 'T', label: '특총', color: '#f59e0b' },
            ].map((pos) => {
              const count = data?.positionCount[pos.key as 'S' | 'R' | 'M' | 'T'] ?? 0;
              const pct = totalPos > 0 ? Math.round((count / totalPos) * 100) : 0;
              return (
                <div key={pos.key} className="dash-position-row">
                  <div className="dash-position-meta">
                    <span className="dash-position-tag" style={{ color: pos.color }}>
                      {pos.key}
                    </span>
                    <span>{pos.label}</span>
                    <span className="dash-position-count">{count}명</span>
                  </div>
                  <div className="dash-progress-track">
                    <div
                      className="dash-progress-fill"
                      style={{ width: `${pct}%`, background: pos.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="dash-grid">
        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>📋 승인 대기 신청</h2>
            <Link href="/applications" className="dash-link">전체 보기 →</Link>
          </div>
          <div className="dash-list">
            {(data?.pendingList ?? []).length === 0 ? (
              <p className="dash-empty">대기 중인 신청이 없습니다</p>
            ) : (
              data?.pendingList.map((app) => (
                <div key={app.id} className="dash-list-item">
                  <div className="dash-list-avatar">{app.position}</div>
                  <div className="dash-list-text">
                    <strong>{app.sudden_nickname}</strong>
                    <span>{app.age}세 · {formatTime(app.created_at)}</span>
                  </div>
                  <span className="dash-badge dash-badge-pending">대기</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>🕐 최근 활동</h2>
            <Link href="/logs" className="dash-link">로그 전체 →</Link>
          </div>
          <div className="dash-list">
            {(data?.recentLogs ?? []).length === 0 ? (
              <p className="dash-empty">활동 로그가 없습니다</p>
            ) : (
              data?.recentLogs.map((log) => (
                <div key={log.id} className="dash-list-item">
                  <div className="dash-list-dot" />
                  <div className="dash-list-text">
                    <strong>{log.action}</strong>
                    <span>{log.description}</span>
                  </div>
                  <span className="dash-list-time">{formatTime(log.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <p className="dash-disclaimer">
        🔒 핵 의심 지표는 공식 제재 확인이 아닌 참고용 통계입니다.
      </p>
    </div>
  );
}
