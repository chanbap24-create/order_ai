'use client';

/**
 * 스켈레톤 로딩 — KREAM 문법(헤어라인 리스트/스탯 스트립/테이블) 모양 그대로의 조용한 펄스.
 * 스피너·"로딩 중..." 텍스트 대신 사용. 펄스는 design-system.css의 .sk 클래스
 * (prefers-reduced-motion 시 자동 정지 — 정적 회색 블록).
 */

export function SkeletonBlock({
  w,
  h = 12,
  r = 4,
  style,
}: {
  w: number | string;
  h?: number;
  r?: number;
  style?: React.CSSProperties;
}) {
  return <span className="sk" style={{ display: 'inline-block', width: w, height: h, borderRadius: r, ...style }} />;
}

/** 헤어라인 리스트 스켈레톤 — 미팅·알림·추천 등 리스트 화면용 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-default)' }} aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 2px', borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <SkeletonBlock w={40} h={13} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock w={`${52 + ((i * 17) % 30)}%`} h={13} />
            <SkeletonBlock w={`${30 + ((i * 11) % 20)}%`} h={10} />
          </div>
          <SkeletonBlock w={64} h={13} />
        </div>
      ))}
    </div>
  );
}

/** 스탯 스트립 스켈레톤 — 요약 숫자 영역용 */
export function StatStripSkeleton({ cells = 3 }: { cells?: number }) {
  return (
    <div
      aria-busy="true"
      style={{
        display: 'flex', alignItems: 'stretch',
        borderTop: '1px solid var(--border-default)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} style={{ flex: 1, padding: '14px 18px', borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
          <SkeletonBlock w={56} h={10} style={{ marginBottom: 8 }} />
          <SkeletonBlock w={84} h={18} />
        </div>
      ))}
    </div>
  );
}

/** 테이블 스켈레톤 — 원장·미수 등 표 화면용 */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-default)' }} aria-busy="true" aria-label="불러오는 중">
      <div style={{ display: 'flex', gap: 16, padding: '10px 2px', borderBottom: '1px solid var(--border-default)' }}>
        <SkeletonBlock w="26%" h={10} />
        <SkeletonBlock w="14%" h={10} />
        <SkeletonBlock w="14%" h={10} />
        <SkeletonBlock w="14%" h={10} />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 2px', borderBottom: '1px solid var(--border-subtle)' }}>
          <SkeletonBlock w={`${20 + ((i * 13) % 16)}%`} h={12} />
          <SkeletonBlock w="14%" h={12} />
          <SkeletonBlock w="14%" h={12} />
          <SkeletonBlock w="14%" h={12} />
        </div>
      ))}
    </div>
  );
}
