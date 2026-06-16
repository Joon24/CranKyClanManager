'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SuspicionBadge } from '@/components/SuspicionBadge';
import { POSITION_META, type Position } from '@shared/types';

interface Mercenary {
  id: string;
  discord_user_id: string;
  sudden_nickname: string;
  server_nickname: string;
  position: string;
  role: string;
  status: string;
  created_at: string;
  warning_count: number;
  match_stats: {
    kd: number;
    win_rate: number;
    suspicion_level: 'normal' | 'caution' | 'review';
  } | null;
}

type FilterTab = 'active' | 'kicked' | 'left' | 'all';

const TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'active', label: '활동 중', icon: '⚔️' },
  { key: 'kicked', label: '추방', icon: '🚫' },
  { key: 'left', label: '탈퇴', icon: '👋' },
  { key: 'all', label: '전체', icon: '📋' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPositionStyle(position: string) {
  if (position in POSITION_META) {
    const meta = POSITION_META[position as Position];
    return { color: meta.color, name: meta.name };
  }
  return { color: '#6b7280', name: position };
}

export default function MercenariesPage() {
  const [mercenaries, setMercenaries] = useState<Mercenary[]>([]);
  const [configError, setConfigError] = useState('');
  const [tab, setTab] = useState<FilterTab>('active');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mercenaries?_=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (data.error && Array.isArray(data.data)) {
        setConfigError(data.error);
        setMercenaries([]);
        return;
      }
      if (Array.isArray(data)) {
        setConfigError('');
        setMercenaries(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const syncStats = useCallback(
    async (userId?: string) => {
      setSyncing(true);
      setSyncError('');
      try {
        const res = await fetch('/api/members/sync-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userId ? { userId } : {}),
        });
        const data = await res.json();
        if (!res.ok) {
          setSyncError(data.error ?? '전적 갱신 실패');
          return;
        }
        await load();
      } catch {
        setSyncError('전적 갱신 중 오류가 발생했습니다.');
      } finally {
        setSyncing(false);
      }
    },
    [load]
  );

  useEffect(() => {
    load();
    syncStats();
  }, [load, syncStats]);

  const counts = useMemo(() => {
    const active = mercenaries.filter((m) => m.status === 'approved').length;
    const kicked = mercenaries.filter((m) => m.status === 'kicked').length;
    const left = mercenaries.filter((m) => m.status === 'left').length;
    const warned = mercenaries.filter((m) => m.warning_count > 0 && m.status === 'approved').length;
    return { active, kicked, left, all: mercenaries.length, warned };
  }, [mercenaries]);

  const filtered = useMemo(() => {
    if (tab === 'all') return mercenaries;
    if (tab === 'active') return mercenaries.filter((m) => m.status === 'approved');
    if (tab === 'kicked') return mercenaries.filter((m) => m.status === 'kicked');
    return mercenaries.filter((m) => m.status === 'left');
  }, [mercenaries, tab]);

  const handleAction = async (userId: string, action: string, payload?: object) => {
    const res = await fetch('/api/mercenaries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, context: 'mercenary', ...payload }),
    });
    if (res.ok) load();
    else {
      const err = await res.json();
      alert(err.error ?? '처리 실패');
    }
  };

  return (
    <div className="merc-page">
      <header className="merc-hero">
        <div>
          <p className="merc-hero-badge">Mercenary Management</p>
          <h1 className="merc-hero-title">용병 관리</h1>
          <p className="merc-hero-sub">
            자동 승인된 용병 인원 · 경고 · 추방 · 탈퇴 처리
          </p>
        </div>
        <div className="merc-hero-stats">
          <div className="merc-hero-stat">
            <span className="merc-hero-stat-val">{counts.active}</span>
            <span className="merc-hero-stat-label">활동 용병</span>
          </div>
          <div className="merc-hero-stat merc-hero-stat-warn">
            <span className="merc-hero-stat-val">{counts.warned}</span>
            <span className="merc-hero-stat-label">경고 누적</span>
          </div>
        </div>
      </header>

      <div className="merc-mini-stats">
        <div className="merc-mini-stat">
          <span>⚔️</span>
          <div>
            <strong>{counts.active}</strong>
            <span>활동 중</span>
          </div>
        </div>
        <div className="merc-mini-stat">
          <span>🚫</span>
          <div>
            <strong>{counts.kicked}</strong>
            <span>추방</span>
          </div>
        </div>
        <div className="merc-mini-stat">
          <span>👋</span>
          <div>
            <strong>{counts.left}</strong>
            <span>탈퇴</span>
          </div>
        </div>
      </div>

      <div className="merc-toolbar">
        <div className="merc-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`merc-tab ${tab === t.key ? 'merc-tab-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span>{t.icon}</span>
              {t.label}
              <span className="merc-tab-count">{counts[t.key === 'active' ? 'active' : t.key === 'all' ? 'all' : t.key]}</span>
            </button>
          ))}
        </div>
        <button className="merc-sync-btn" onClick={() => syncStats()} disabled={syncing}>
          {syncing ? '갱신 중...' : '↻ 전적 갱신'}
        </button>
      </div>

      {configError && <p className="merc-error">{configError}</p>}
      {syncError && <p className="merc-error">{syncError}</p>}

      {loading ? (
        <div className="merc-loading">
          <div className="app-spinner" />
          <p>용병 목록 불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="merc-empty">
          <div className="merc-empty-icon">⚔️</div>
          <h3>용병이 없습니다</h3>
          <p>Discord 용병 신청으로 자동 등록된 인원이 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="merc-list">
          {filtered.map((m) => {
            const stats = Array.isArray(m.match_stats) ? m.match_stats[0] : m.match_stats;
            const pos = getPositionStyle(m.position);
            const isActive = m.status === 'approved';

            return (
              <article key={m.id} className="merc-card">
                <div className="merc-card-pos" style={{ color: pos.color, borderColor: pos.color }}>
                  {m.position}
                </div>
                <div className="merc-card-main">
                  <div className="merc-card-header">
                    <div>
                      <h3>{m.sudden_nickname}</h3>
                      <p>{m.server_nickname ?? '-'} · {pos.name}</p>
                    </div>
                    <div className="merc-card-badges">
                      <span className={`merc-badge merc-badge-${m.status}`}>
                        {m.status === 'approved' ? '활동' : m.status === 'kicked' ? '추방' : m.status === 'left' ? '탈퇴' : m.status}
                      </span>
                      {m.warning_count > 0 && (
                        <span className="merc-badge merc-badge-warn">경고 {m.warning_count}</span>
                      )}
                    </div>
                  </div>
                  <div className="merc-card-grid">
                    <div>
                      <span className="merc-field-label">KD</span>
                      <span>{syncing ? '...' : stats?.kd ?? '-'}</span>
                    </div>
                    <div>
                      <span className="merc-field-label">승률</span>
                      <span>{syncing ? '...' : stats?.win_rate != null ? `${stats.win_rate}%` : '-'}</span>
                    </div>
                    <div>
                      <span className="merc-field-label">의심지표</span>
                      <span>
                        {stats?.suspicion_level ? (
                          <SuspicionBadge level={stats.suspicion_level} />
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="merc-field-label">등록일</span>
                      <span>{formatDate(m.created_at)}</span>
                    </div>
                  </div>
                </div>
                {isActive && (
                  <div className="merc-card-actions">
                    <button
                      className="merc-action-btn merc-action-sync"
                      onClick={() => syncStats(m.id)}
                      disabled={syncing}
                      title="전적 갱신"
                    >
                      ↻
                    </button>
                    <button
                      className="merc-action-btn merc-action-warn"
                      onClick={() => {
                        const reason = prompt('경고 사유');
                        if (reason) handleAction(m.id, 'warn', { reason });
                      }}
                    >
                      ⚠️ 경고
                    </button>
                    <button
                      className="merc-action-btn merc-action-kick"
                      onClick={() => {
                        const reason = prompt('추방 사유');
                        if (reason) handleAction(m.id, 'kick', { reason });
                      }}
                    >
                      🚫 추방
                    </button>
                    <button
                      className="merc-action-btn merc-action-leave"
                      onClick={() => {
                        if (confirm(`${m.sudden_nickname} 용병을 탈퇴 처리할까요?`)) {
                          handleAction(m.id, 'leave');
                        }
                      }}
                    >
                      👋 탈퇴
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
