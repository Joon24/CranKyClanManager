'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatusBadge } from './SuspicionBadge';
import { dedupeApplications } from '@/lib/application-dedupe';
import { POSITION_META, buildServerNickname, type Position } from '@shared/types';

interface Application {
  id: string;
  discord_user_id: string;
  sudden_nickname: string;
  age: number;
  position: string;
  main_time: string;
  previous_clan: string | null;
  join_source: string;
  api_check_status: string;
  status: string;
  created_at: string;
}

type FilterTab = 'all' | 'pending' | 'on_hold' | 'approved' | 'rejected' | 'blocked';

const TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'all', label: '전체', icon: '📋' },
  { key: 'pending', label: '대기', icon: '⏳' },
  { key: 'on_hold', label: '보류', icon: '⏸️' },
  { key: 'approved', label: '승인', icon: '✅' },
  { key: 'rejected', label: '거절', icon: '❌' },
  { key: 'blocked', label: '블랙', icon: '🚫' },
];

const ACTION_STATUS: Record<string, Application['status']> = {
  approve: 'approved',
  reject: 'rejected',
  hold: 'on_hold',
  blacklist: 'blocked',
};

const ACTION_TAB: Record<string, FilterTab> = {
  approve: 'approved',
  reject: 'rejected',
  hold: 'on_hold',
  blacklist: 'blocked',
};

const POSITION_STYLE: Record<string, { color: string; bg: string }> = {
  S: { color: POSITION_META.S.color, bg: 'rgba(239,68,68,0.15)' },
  R: { color: POSITION_META.R.color, bg: 'rgba(59,130,246,0.15)' },
  M: { color: POSITION_META.M.color, bg: 'rgba(168,85,247,0.15)' },
  T: { color: POSITION_META.T.color, bg: 'rgba(245,158,11,0.15)' },
};

const API_STATUS: Record<string, { label: string; className: string }> = {
  success: { label: 'API 확인', className: 'app-api-ok' },
  not_found: { label: '미발견', className: 'app-api-warn' },
  failed: { label: '실패', className: 'app-api-fail' },
  pending: { label: '대기', className: 'app-api-pending' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildNickname(app: Application) {
  return buildServerNickname(app.sudden_nickname, app.position as Position, app.age);
}

function applyLocalStatus(
  apps: Application[],
  id: string,
  type: string
): Application[] {
  const nextStatus = ACTION_STATUS[type];
  if (!nextStatus) return apps;

  const target = apps.find((a) => a.id === id);
  if (!target) return apps;

  const updated = apps.map((a) => {
    if (a.id === id) return { ...a, status: nextStatus };
    if (
      type === 'approve' &&
      a.discord_user_id === target.discord_user_id &&
      (a.status === 'pending' || a.status === 'on_hold')
    ) {
      return { ...a, status: 'rejected' };
    }
    return a;
  });

  return dedupeApplications(updated);
}

export function ApplicationTable() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('pending');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/applications?_=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setApps(data);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = TABS.reduce(
    (acc, t) => {
      acc[t.key] =
        t.key === 'all' ? apps.length : apps.filter((a) => a.status === t.key).length;
      return acc;
    },
    {} as Record<FilterTab, number>
  );

  const filtered =
    tab === 'all' ? apps : apps.filter((a) => a.status === tab);

  const action = async (id: string, type: string, body?: object) => {
    setActing(id);
    try {
      const res = await fetch(`/api/applications/${id}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setApps((prev) => applyLocalStatus(prev, id, type));
        const nextTab = ACTION_TAB[type];
        if (nextTab) setTab(nextTab);
        await load(true);
      } else {
        alert((data as { error?: string }).error ?? '처리 실패');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="app-page">
      <header className="app-hero">
        <div>
          <p className="dash-hero-badge">Application Management</p>
          <h1 className="dash-hero-title">가입 신청 관리</h1>
          <p className="dash-hero-sub">
            신청 검토 · 승인 · 거절 · 보류 · 블랙리스트 처리
          </p>
        </div>
        <div className="app-hero-stats">
          <div className="app-hero-stat">
            <span className="app-hero-stat-val">{counts.pending}</span>
            <span className="app-hero-stat-label">승인 대기</span>
          </div>
          <div className="app-hero-stat">
            <span className="app-hero-stat-val">{counts.on_hold}</span>
            <span className="app-hero-stat-label">보류</span>
          </div>
          <div className="app-hero-stat">
            <span className="app-hero-stat-val">{counts.approved}</span>
            <span className="app-hero-stat-label">승인 완료</span>
          </div>
        </div>
      </header>

      <div className="app-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`app-tab ${tab === t.key ? 'app-tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span>
            {t.label}
            <span className="app-tab-count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
          <p>신청 목록 불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="app-empty">
          <div className="app-empty-icon">📭</div>
          <h3>신청 내역이 없습니다</h3>
          <p>
            {tab === 'pending'
              ? '현재 승인 대기 중인 신청이 없습니다.'
              : '해당 상태의 신청이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="app-list">
          {filtered.map((app) => {
            const pos = POSITION_STYLE[app.position] ?? {
              color: '#6b7280',
              bg: 'rgba(107,114,128,0.15)',
            };
            const api = API_STATUS[app.api_check_status] ?? API_STATUS.pending;
            const canAct = app.status === 'pending' || app.status === 'on_hold';
            const isActing = acting === app.id;

            return (
              <article key={app.id} className="app-card">
                <div
                  className="app-card-position"
                  style={{ color: pos.color, background: pos.bg }}
                >
                  {app.position}
                </div>

                <div className="app-card-main">
                  <div className="app-card-header">
                    <div>
                      <h3 className="app-card-name">{app.sudden_nickname}</h3>
                      <p className="app-card-nick-preview">
                        승인 시 별명: <strong>{buildNickname(app)}</strong>
                      </p>
                    </div>
                    <div className="app-card-badges">
                      <StatusBadge status={app.status} />
                      <span className={`app-api-badge ${api.className}`}>{api.label}</span>
                    </div>
                  </div>

                  <div className="app-card-grid">
                    <div className="app-card-field">
                      <span className="app-field-label">나이</span>
                      <span>{app.age}세</span>
                    </div>
                    <div className="app-card-field">
                      <span className="app-field-label">접속 시간</span>
                      <span>{app.main_time}</span>
                    </div>
                    <div className="app-card-field">
                      <span className="app-field-label">이전 클랜</span>
                      <span>{app.previous_clan ?? '없음'}</span>
                    </div>
                    <div className="app-card-field">
                      <span className="app-field-label">가입 경로</span>
                      <span>{app.join_source}</span>
                    </div>
                  </div>

                  <div className="app-card-footer">
                    <span className="app-card-date">📅 {formatDate(app.created_at)}</span>
                    <span className="app-card-discord">Discord ID: {app.discord_user_id}</span>
                  </div>
                </div>

                {canAct && (
                  <div className="app-card-actions">
                    <button
                      className="app-action-btn app-action-approve"
                      disabled={isActing}
                      onClick={() => action(app.id, 'approve')}
                    >
                      {isActing ? '처리 중...' : '✅ 승인'}
                    </button>
                    <button
                      className="app-action-btn app-action-reject"
                      disabled={isActing}
                      onClick={() => {
                        const reason = prompt('거절 사유 (선택)');
                        action(app.id, 'reject', { reason });
                      }}
                    >
                      ❌ 거절
                    </button>
                    <button
                      className="app-action-btn app-action-hold"
                      disabled={isActing}
                      onClick={() => action(app.id, 'hold')}
                    >
                      ⏸️ 보류
                    </button>
                    <button
                      className="app-action-btn app-action-black"
                      disabled={isActing}
                      onClick={() => {
                        const reason = prompt('블랙리스트 사유');
                        if (reason) action(app.id, 'blacklist', { reason });
                      }}
                    >
                      🚫 블랙
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
