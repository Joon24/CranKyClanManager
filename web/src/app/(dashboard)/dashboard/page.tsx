'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePolling } from '@/hooks/usePolling';

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
  todayJoinList: {
    id: string;
    sudden_nickname: string;
    server_nickname: string | null;
    position: string;
    created_at: string;
  }[];
  warningUserList: {
    id: string;
    sudden_nickname: string;
    server_nickname: string | null;
    position: string;
    warning_count: number;
    warning_points: number;
    latest_reason: string;
  }[];
  reviewTargetList: {
    id: string;
    sudden_nickname: string;
    server_nickname: string | null;
    position: string;
    suspicion_score: number;
    kd: number | null;
    win_rate: number | null;
  }[];
}

type StatDetailKey = 'todayJoins' | 'warningUsers' | 'reviewTargets';

const STAT_CARDS = [
  { key: 'totalMembers' as const, label: '총 인원', icon: '👥', accent: '#3b82f6', glow: 'rgba(59,130,246,0.25)' },
  { key: 'pendingApps' as const, label: '승인 대기', icon: '⏳', accent: '#f59e0b', glow: 'rgba(245,158,11,0.25)', href: '/applications' },
  { key: 'todayJoins' as const, label: '오늘 가입', icon: '✨', accent: '#22c55e', glow: 'rgba(34,197,94,0.25)', detail: 'todayJoins' as const },
  { key: 'warningUsers' as const, label: '경고 누적', icon: '⚠️', accent: '#eab308', glow: 'rgba(234,179,8,0.25)', detail: 'warningUsers' as const },
  { key: 'reviewTargets' as const, label: '검토 대상', icon: '🔍', accent: '#ef4444', glow: 'rgba(239,68,68,0.25)', detail: 'reviewTargets' as const },
];

const DETAIL_TITLES: Record<StatDetailKey, string> = {
  todayJoins: '✨ 오늘 가입',
  warningUsers: '⚠️ 경고 누적',
  reviewTargets: '🔍 검토 대상',
};

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
  const [activeDetail, setActiveDetail] = useState<StatDetailKey | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?_=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 5000);

  useEffect(() => {
    if (!activeDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDetail]);

  const renderDetailContent = () => {
    if (!data || !activeDetail) return null;

    if (activeDetail === 'todayJoins') {
      if (data.todayJoinList.length === 0) {
        return <p className="dash-empty">오늘 가입한 클랜원이 없습니다</p>;
      }
      return data.todayJoinList.map((member) => (
        <div key={member.id} className="dash-list-item">
          <div className="dash-list-avatar">{member.position}</div>
          <div className="dash-list-text">
            <strong>{member.sudden_nickname}</strong>
            <span>
              {member.server_nickname ? `${member.server_nickname} · ` : ''}
              {formatTime(member.created_at)}
            </span>
          </div>
          <Link href="/members" className="dash-link" onClick={() => setActiveDetail(null)}>
            보기
          </Link>
        </div>
      ));
    }

    if (activeDetail === 'warningUsers') {
      if (data.warningUserList.length === 0) {
        return <p className="dash-empty">경고가 누적된 클랜원이 없습니다</p>;
      }
      return data.warningUserList.map((member) => (
        <div key={member.id} className="dash-list-item">
          <div className="dash-list-avatar">{member.position}</div>
          <div className="dash-list-text">
            <strong>{member.sudden_nickname}</strong>
            <span>
              {member.warning_count}회 · {member.warning_points}점
              {member.latest_reason ? ` · ${member.latest_reason}` : ''}
            </span>
          </div>
          <span className="dash-badge dash-badge-warning">{member.warning_points}점</span>
        </div>
      ));
    }

    if (data.reviewTargetList.length === 0) {
      return <p className="dash-empty">검토 대상 클랜원이 없습니다</p>;
    }
    return data.reviewTargetList.map((member) => (
      <div key={member.id} className="dash-list-item">
        <div className="dash-list-avatar">{member.position}</div>
        <div className="dash-list-text">
          <strong>{member.sudden_nickname}</strong>
          <span>
            의심 {member.suspicion_score}점
            {member.kd != null ? ` · K/D ${member.kd.toFixed(2)}` : ''}
            {member.win_rate != null ? ` · 승률 ${member.win_rate.toFixed(1)}%` : ''}
          </span>
        </div>
        <Link href={`/stats?q=${encodeURIComponent(member.sudden_nickname)}`} className="dash-link" onClick={() => setActiveDetail(null)}>
          전적
        </Link>
      </div>
    ));
  };

  const totalPos =
    (data?.positionCount.S ?? 0) +
    (data?.positionCount.R ?? 0) +
    (data?.positionCount.M ?? 0) +
    (data?.positionCount.T ?? 0) +
    (data?.positionCount.other ?? 0);

  return (
    <div className="dashboard">
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
        {STAT_CARDS.map((card) => {
          const value = loading ? '—' : (data?.[card.key] ?? 0);
          const cardStyle = { '--accent': card.accent, '--glow': card.glow } as CSSProperties;

          if ('href' in card && card.href) {
            return (
              <Link
                key={card.key}
                href={card.href}
                className="dash-stat-card dash-stat-card-clickable"
                style={cardStyle}
              >
                <div className="dash-stat-icon">{card.icon}</div>
                <div className="dash-stat-body">
                  <span className="dash-stat-label">{card.label}</span>
                  <span className="dash-stat-value">{value}</span>
                </div>
                {card.key === 'pendingApps' && (data?.pendingApps ?? 0) > 0 && (
                  <span className="dash-pulse" />
                )}
              </Link>
            );
          }

          if ('detail' in card && card.detail) {
            return (
              <button
                key={card.key}
                type="button"
                className="dash-stat-card dash-stat-card-clickable"
                style={cardStyle}
                onClick={() => setActiveDetail(card.detail)}
                aria-label={`${card.label} 목록 보기`}
              >
                <div className="dash-stat-icon">{card.icon}</div>
                <div className="dash-stat-body">
                  <span className="dash-stat-label">{card.label}</span>
                  <span className="dash-stat-value">{value}</span>
                </div>
                <span className="dash-stat-hint">목록</span>
              </button>
            );
          }

          return (
            <div key={card.key} className="dash-stat-card" style={cardStyle}>
              <div className="dash-stat-icon">{card.icon}</div>
              <div className="dash-stat-body">
                <span className="dash-stat-label">{card.label}</span>
                <span className="dash-stat-value">{value}</span>
              </div>
            </div>
          );
        })}
      </section>

      {activeDetail && (
        <div
          className="dash-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dash-stat-modal-title"
          onClick={() => setActiveDetail(null)}
        >
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-header">
              <h2 id="dash-stat-modal-title">{DETAIL_TITLES[activeDetail]}</h2>
              <button
                type="button"
                className="dash-modal-close"
                onClick={() => setActiveDetail(null)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <p className="dash-modal-count">
              총 {loading ? '—' : (data?.[activeDetail] ?? 0)}명
            </p>
            <div className="dash-list dash-modal-list">{renderDetailContent()}</div>
          </div>
        </div>
      )}

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
