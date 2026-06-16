'use client';

import dynamic from 'next/dynamic';

const EmbedGenerator = dynamic(
  () => import('@/components/embed/EmbedGenerator').then((m) => ({ default: m.EmbedGenerator })),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: 32 }}>
        <h1 className="page-title">임베드 생성기</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>불러오는 중…</p>
      </div>
    ),
  }
);

export default function EmbedPage() {
  return <EmbedGenerator />;
}
