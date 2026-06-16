import { SUSPICION_LABELS, type SuspicionLevel } from '@shared/types';

export function SuspicionBadge({ level }: { level: SuspicionLevel }) {
  const { emoji, label } = SUSPICION_LABELS[level];
  return (
    <span title="참고용 지표 (공식 제재 아님)">
      {emoji} {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: '대기',
    approved: '승인',
    rejected: '거절',
    on_hold: '보류',
    blocked: '블랙',
  };
  return <span className={`badge badge-${status}`}>{labels[status] ?? status}</span>;
}
