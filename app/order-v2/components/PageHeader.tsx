"use client";

/** Order 페이지 헤더 — 다른 페이지와 동일한 title + accent bar. v3 베타 이동 버튼 포함 */
export function PageHeader() {
  return (
    <header
      style={{
        paddingBottom: 16,
        marginBottom: 20,
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
      }}
    >
      <a
        href="/order-v3"
        style={{
          position: 'absolute', right: 0, top: 2,
          padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
          border: '1px solid var(--action)', borderRadius: 9,
          color: 'var(--action)', textDecoration: 'none', background: 'var(--surface)',
        }}
      >
        발주 v3 베타 →
      </a>
      <h1
        style={{

          fontSize: '1.5rem',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '0.01em',
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        Order
      </h1>
      <div
        style={{
          width: 32,
          height: 2,
          marginTop: 10,
          background: 'var(--action)',
          borderRadius: 1,
        }}
      />
    </header>
  );
}
