'use client';

import { useEffect, useMemo, useState } from 'react';
import { POSITION_META, type Position } from '@shared/types';
import {
  getCompositionHint,
  getRequiredPlayers,
  type QuickType,
} from '@/lib/team-balance';

interface Member {
  id: string;
  sudden_nickname: string | null;
  server_nickname?: string | null;
  position: string;
  match_stats: { kd: number; tier_name: string } | { kd: number; tier_name: string }[] | null;
}

interface TeamResult {
  quickType: string;
  quickIndex: number;
  teamLabel: string;
  label: string;
  members: Member[];
  totalScore: number;
  composition: string;
}

interface BalanceResult {
  teams: TeamResult[];
  reserve: Member[];
  planSummary: string;
}

const QUICK_TYPES: { type: QuickType; label: string; desc: string }[] = [
  { type: '33', label: '33', desc: '1퀵 = A팀 3명 · 타 클랜 3v3' },
  { type: '44', label: '44', desc: '1퀵 = A팀 4명 · 타 클랜 4v4' },
  { type: '55', label: '55', desc: '1퀵 = A팀 5명 · 타 클랜 5v5' },
];

const MODES = [
  { key: 'kd' as const, label: 'KD 기준', icon: '🎯', desc: '최근 전적 KD' },
  {
    key: 'position' as const,
    label: '포지션 기준',
    icon: '🎖️',
    desc: 'S 스나 · R 라플 · M 멀티 · T 특총',
  },
  { key: 'tier' as const, label: '티어 기준', icon: '⭐', desc: '시즌 티어' },
];

function getPositionColor(position: string) {
  if (position in POSITION_META) {
    return POSITION_META[position as Position].color;
  }
  return '#6b7280';
}

function getPositionName(position: string) {
  if (position in POSITION_META) {
    return POSITION_META[position as Position].name;
  }
  return position;
}

const TEAM_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];

function TeamCard({ team, colorIndex }: { team: TeamResult; colorIndex: number }) {
  const color = TEAM_COLORS[colorIndex % TEAM_COLORS.length];

  return (
    <div className="team-lobby-card">
      <div className="team-vs-header">
        <h3>{team.label}</h3>
        <p className="team-composition-result">{team.composition}</p>
        <p className="team-composition-note">실력 합계 {team.totalScore}</p>
      </div>

      <div className="team-single-box" style={{ borderColor: `${color}55` }}>
        <div className="team-vs-title" style={{ color }}>
          <span className="team-vs-icon">⚔️</span>
          {team.teamLabel}
          <span className="team-vs-score">{team.members.length}명</span>
        </div>
        <ul className="team-vs-list">
          {team.members.map((m, i) => (
            <li key={m.id}>
              <span className="team-slot">#{i + 1}</span>
              <span
                className="team-pos-mini"
                style={{ color: getPositionColor(m.position) }}
              >
                {m.position}
              </span>
              {m.sudden_nickname ?? '-'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function TeamBalancePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'kd' | 'position' | 'tier'>('kd');
  const [quickType, setQuickType] = useState<QuickType>('44');
  const [quickCount, setQuickCount] = useState(1);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [balancing, setBalancing] = useState(false);

  useEffect(() => {
    fetch('/api/members')
      .then((r) => r.json())
      .then((data) =>
        setMembers(
          data.filter(
            (m: { status: string; member_type?: string }) =>
              m.status === 'approved' &&
              (m.member_type === 'member' || !m.member_type)
          )
        )
      );
  }, []);

  const getStats = (m: Member) =>
    Array.isArray(m.match_stats) ? m.match_stats[0] : m.match_stats;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setResult(null);
  };

  const selectAll = () => {
    setSelected(new Set(members.map((m) => m.id)));
    setResult(null);
  };

  const clearAll = () => {
    setSelected(new Set());
    setResult(null);
  };

  const compositionHint = useMemo(
    () => getCompositionHint(selected.size, quickType, quickCount),
    [selected.size, quickType, quickCount]
  );

  const requiredPlayers = getRequiredPlayers(quickType, quickCount);
  const selectedQuick = QUICK_TYPES.find((q) => q.type === quickType)!;

  const selectedMembers = useMemo(
    () => members.filter((m) => selected.has(m.id)),
    [members, selected]
  );

  const balance = async () => {
    setBalancing(true);
    try {
      const res = await fetch('/api/team-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, quickType, quickCount, memberIds: [...selected] }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else alert(data.error);
    } finally {
      setBalancing(false);
    }
  };

  const canBalance = selected.size >= requiredPlayers;

  return (
    <div className="team-page">
      <header className="team-hero">
        <div>
          <p className="dash-hero-badge">Team Balance</p>
          <h1 className="dash-hero-title">팀 밸런스</h1>
          <p className="dash-hero-sub">
            1퀵 = A팀 · 2퀵 = A+B팀 · 각 팀은 타 클랜과 매칭 (내전 아님)
          </p>
        </div>
        <div className="team-hero-badge-count">
          <span className="team-count-num">{selected.size}</span>
          <span className="team-count-label">명 선택됨</span>
        </div>
      </header>

      <section className="team-section">
        <h2 className="team-section-title">🎮 퀵 타입</h2>
        <div className="team-modes">
          {QUICK_TYPES.map((q) => (
            <button
              key={q.type}
              className={`team-mode-card ${quickType === q.type ? 'team-mode-active' : ''}`}
              onClick={() => {
                setQuickType(q.type);
                setResult(null);
              }}
            >
              <span className="team-mode-icon">{q.label}</span>
              <span className="team-mode-label">{q.label} 퀵</span>
              <span className="team-mode-desc">{q.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="team-section">
        <h2 className="team-section-title">🔢 퀵 수</h2>
        <div className="team-quick-count">
          <button
            type="button"
            className="team-quick-count-btn"
            disabled={quickCount <= 1}
            onClick={() => {
              setQuickCount((c) => Math.max(1, c - 1));
              setResult(null);
            }}
          >
            −
          </button>
          <div className="team-quick-count-display">
            <span className="team-quick-count-num">{quickCount}</span>
            <span className="team-quick-count-label">
              퀵 · {requiredPlayers}명 · {quickCount}팀
            </span>
          </div>
          <button
            type="button"
            className="team-quick-count-btn"
            disabled={quickCount >= 20}
            onClick={() => {
              setQuickCount((c) => Math.min(20, c + 1));
              setResult(null);
            }}
          >
            +
          </button>
        </div>
        <p className="team-composition-note" style={{ marginTop: 8 }}>
          {quickType} {quickCount}퀵 = {quickCount === 1 ? 'A팀' : quickCount === 2 ? 'A팀 + B팀' : `A~${String.fromCharCode(64 + quickCount)}팀`} · 총 {requiredPlayers}명
        </p>
      </section>

      <section className="team-section">
        <h2 className="team-section-title">⚖️ 밸런스 기준</h2>
        <div className="team-modes">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`team-mode-card ${mode === m.key ? 'team-mode-active' : ''}`}
              onClick={() => {
                setMode(m.key);
                setResult(null);
              }}
            >
              <span className="team-mode-icon">{m.icon}</span>
              <span className="team-mode-label">{m.label}</span>
              <span className="team-mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="team-panel">
        {selected.size > 0 && compositionHint && (
          <p className="team-composition-status" style={{ marginBottom: 16 }}>
            선택 {selected.size}명 · {compositionHint}
          </p>
        )}
        <div className="team-panel-header">
          <h2>👥 클랜원 선택</h2>
          <div className="team-select-actions">
            <button className="team-link-btn" onClick={selectAll}>
              전체 선택
            </button>
            <button className="team-link-btn" onClick={clearAll}>
              선택 해제
            </button>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="team-empty">승인된 클랜원이 없습니다.</div>
        ) : (
          <div className="team-member-grid">
            {members.map((m) => {
              const stats = getStats(m);
              const isSelected = selected.has(m.id);
              const posColor = getPositionColor(m.position);
              return (
                <button
                  key={m.id}
                  className={`team-member-card ${isSelected ? 'team-member-selected' : ''}`}
                  onClick={() => toggle(m.id)}
                >
                  <div
                    className="team-member-pos"
                    style={{ color: posColor, borderColor: posColor }}
                    title={getPositionName(m.position)}
                  >
                    {m.position || '-'}
                  </div>
                  <div className="team-member-info">
                    <strong>{m.sudden_nickname ?? m.server_nickname ?? '-'}</strong>
                    <span>
                      {getPositionName(m.position)} · KD {stats?.kd ?? '-'} ·{' '}
                      {stats?.tier_name ?? '티어 미확인'}
                    </span>
                  </div>
                  <div className={`team-check ${isSelected ? 'team-check-on' : ''}`}>
                    {isSelected ? '✓' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          className="team-balance-btn"
          onClick={balance}
          disabled={!canBalance || balancing}
        >
          {balancing
            ? '분배 중...'
            : `⚔️ ${selectedQuick.label} ${quickCount}퀵 분배 (${selected.size}명)`}
        </button>
      </section>

      {result && (
        <section className="team-result-section">
          <div className="team-vs-header">
            <h2>분배 결과</h2>
            <p className="team-composition-result">{result.planSummary}</p>
          </div>

          {result.teams.map((team, i) => (
            <TeamCard key={team.label} team={team} colorIndex={i} />
          ))}

          {result.reserve.length > 0 && (
            <div className="team-reserve-panel">
              <h3>⏸️ 대기 ({result.reserve.length}명)</h3>
              <p className="team-composition-note">
                필요 인원을 초과해 선택한 멤버입니다.
              </p>
              <ul className="team-vs-list">
                {result.reserve.map((m) => (
                  <li key={m.id}>
                    <span
                      className="team-pos-mini"
                      style={{ color: getPositionColor(m.position) }}
                    >
                      {m.position || '-'}
                    </span>
                    {m.sudden_nickname ?? '-'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
