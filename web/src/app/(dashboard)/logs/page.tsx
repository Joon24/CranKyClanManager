'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

interface LogEntry {
  id: string;
  action: string;
  description: string;
  created_by: string | null;
  created_at: string;
  users: { sudden_nickname: string; discord_username: string } | null;
}

const FILTERS = [
  { key: '', label: '전체', icon: '📋' },
  { key: '가입', label: '가입', icon: '✨' },
  { key: '승인', label: '승인', icon: '✅' },
  { key: '경고', label: '경고', icon: '⚠️' },
  { key: '추방', label: '추방', icon: '🚫' },
  { key: '탈퇴', label: '탈퇴', icon: '👋' },
  { key: '블랙', label: '블랙', icon: '⛔' },
] as const;

type ActionStyle = { icon: string; color: string; bg: string; glow: string };

function getActionStyle(action: string): ActionStyle {
  if (action.includes('가입')) return { icon: '✨', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', glow: 'rgba(59,130,246,0.25)' };
  if (action.includes('승인')) return { icon: '✅', color: '#86efac', bg: 'rgba(34,197,94,0.15)', glow: 'rgba(34,197,94,0.25)' };
  if (action.includes('경고')) return { icon: '⚠️', color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', glow: 'rgba(234,179,8,0.25)' };
  if (action.includes('추방')) return { icon: '🚫', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)', glow: 'rgba(239,68,68,0.25)' };
  if (action.includes('탈퇴')) return { icon: '👋', color: '#a1a1aa', bg: 'rgba(161,161,170,0.12)', glow: 'rgba(161,161,170,0.2)' };
  if (action.includes('블랙') || action.includes('차단')) return { icon: '⛔', color: '#f87171', bg: 'rgba(127,29,29,0.2)', glow: 'rgba(239,68,68,0.2)' };
  if (action.includes('등급') || action.includes('역할')) return { icon: '🎖️', color: '#c4b5fd', bg: 'rgba(139,92,246,0.15)', glow: 'rgba(139,92,246,0.25)' };
  if (action.includes('별명')) return { icon: '📝', color: '#67e8f9', bg: 'rgba(6,182,212,0.15)', glow: 'rgba(6,182,212,0.25)' };
  if (action.includes('관리자')) return { icon: '🔧', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', glow: 'rgba(148,163,184,0.2)' };
  return { icon: '🔹', color: '#93c5fd', bg: 'rgba(59,130,246,0.1)', glow: 'rgba(59,130,246,0.15)' };
}

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFullTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function parseDescription(description: string) {
  if (!description.includes(' | ')) return null;
  return description.split(' | ').map((part) => {
    const idx = part.indexOf(':');
    if (idx === -1) return { label: part, value: '' };
    return { label: part.slice(0, idx).trim(), value: part.slice(idx + 1).trim() };
  });
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/logs?limit=100')
      .then((r) => r.json())
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = logs.filter((l) => new Date(l.created_at) >= today).length;
    const joinCount = logs.filter((l) => l.action.includes('가입')).length;
    const warnCount = logs.filter((l) => l.action.includes('경고')).length;
    const leaveCount = logs.filter((l) => l.action.includes('탈퇴') || l.action.includes('추방')).length;
    return { total: logs.length, todayCount, joinCount, warnCount, leaveCount };
  }, [logs]);

  const typeFilteredLogs = useMemo(() => {
    if (!filter) return logs;
    return logs.filter((l) => l.action.includes(filter));
  }, [logs, filter]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return typeFilteredLogs;
    const q = search.toLowerCase();
    return typeFilteredLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        (l.created_by?.toLowerCase().includes(q) ?? false) ||
        (l.users?.sudden_nickname?.toLowerCase().includes(q) ?? false)
    );
  }, [typeFilteredLogs, search]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { '': logs.length };
    for (const f of FILTERS) {
      if (!f.key) continue;
      counts[f.key] = logs.filter((l) => l.action.includes(f.key)).length;
    }
    return counts;
  }, [logs]);

  return (
    <div className="logs-page">
      <header className="logs-hero">
        <div className="logs-hero-content">
          <p className="logs-hero-badge">Audit Trail</p>
          <h1 className="logs-hero-title">활동 로그</h1>
          <p className="logs-hero-sub">클랜 가입 · 승인 · 경고 · 탈퇴 등 모든 관리 활동을 추적합니다</p>
        </div>
        <div className="logs-hero-stats">
          <div className="logs-hero-stat">
            <span className="logs-hero-stat-val">{loading ? '—' : (filter ? filteredLogs.length : stats.total)}</span>
            <span className="logs-hero-stat-label">{filter || search ? '필터 결과' : '전체'}</span>
          </div>
          <div className="logs-hero-stat">
            <span className="logs-hero-stat-val">{loading ? '—' : stats.todayCount}</span>
            <span className="logs-hero-stat-label">오늘</span>
          </div>
        </div>
      </header>

      <section className="logs-mini-stats">
        {[
          { label: '가입 관련', value: stats.joinCount, icon: '✨', accent: '#3b82f6', glow: 'rgba(59,130,246,0.2)' },
          { label: '경고', value: stats.warnCount, icon: '⚠️', accent: '#eab308', glow: 'rgba(234,179,8,0.2)' },
          { label: '탈퇴·추방', value: stats.leaveCount, icon: '👋', accent: '#a1a1aa', glow: 'rgba(161,161,170,0.2)' },
        ].map((s) => (
          <div
            key={s.label}
            className="logs-mini-stat"
            style={{ '--accent': s.accent, '--glow': s.glow } as CSSProperties}
          >
            <span className="logs-mini-stat-icon">{s.icon}</span>
            <div>
              <span className="logs-mini-stat-val">{loading ? '—' : s.value}</span>
              <span className="logs-mini-stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="logs-toolbar">
        <div className="logs-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`logs-tab ${filter === f.key ? 'logs-tab-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              <span>{f.icon}</span>
              {f.label}
              {!loading && filterCounts[f.key] !== undefined && (
                <span className="logs-tab-count">{filterCounts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="logs-search">
          <span className="logs-search-icon">🔍</span>
          <input
            className="logs-search-input"
            placeholder="액션, 설명, 대상, 처리자 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="logs-loading">
          <div className="app-spinner" />
          <p>로그 불러오는 중...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="logs-empty">
          <div className="logs-empty-icon">📭</div>
          <h3>활동 로그가 없습니다</h3>
          <p>{search ? '검색 조건에 맞는 로그가 없습니다' : '아직 기록된 활동이 없습니다'}</p>
        </div>
      ) : (
        <div className="logs-timeline">
          {filteredLogs.map((log, i) => {
            const style = getActionStyle(log.action);
            const target = log.users?.sudden_nickname ?? '-';
            const processor = log.created_by ?? '시스템';
            const parsed = parseDescription(log.description);
            const isLast = i === filteredLogs.length - 1;

            return (
              <div key={log.id} className="logs-entry">
                <div className="logs-entry-rail">
                  <div
                    className="logs-entry-dot"
                    style={{ background: style.color, boxShadow: `0 0 12px ${style.glow}` }}
                  />
                  {!isLast && <div className="logs-entry-line" />}
                </div>

                <article
                  className="logs-card"
                  style={{ '--card-glow': style.glow, '--card-accent': style.color } as CSSProperties}
                >
                  <div className="logs-card-accent" />

                  <div className="logs-card-header">
                    <div
                      className="logs-card-icon"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.icon}
                    </div>
                    <div className="logs-card-meta">
                      <span className="logs-action-badge" style={{ background: style.bg, color: style.color }}>
                        {log.action}
                      </span>
                      <time className="logs-card-time" title={formatFullTime(log.created_at)}>
                        {formatRelativeTime(log.created_at)}
                      </time>
                    </div>
                  </div>

                  {parsed ? (
                    <div className="logs-detail-grid">
                      {parsed.map((field) => (
                        <div key={field.label} className="logs-detail-field">
                          <span className="logs-detail-label">{field.label}</span>
                          <span className="logs-detail-value">{field.value || '-'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="logs-card-desc">{log.description}</p>
                  )}

                  <div className="logs-card-footer">
                    <div className="logs-user-chip">
                      <span className="logs-user-avatar logs-user-avatar-target">
                        {getInitial(target === '-' ? '?' : target)}
                      </span>
                      <div>
                        <span className="logs-user-role">대상</span>
                        <span className="logs-user-name">{target}</span>
                      </div>
                    </div>
                    <div className="logs-footer-divider" />
                    <div className="logs-user-chip">
                      <span className="logs-user-avatar logs-user-avatar-processor">
                        {getInitial(processor)}
                      </span>
                      <div>
                        <span className="logs-user-role">처리자</span>
                        <span className="logs-user-name">{processor}</span>
                      </div>
                    </div>
                    <span className="logs-full-time">{formatFullTime(log.created_at)}</span>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
