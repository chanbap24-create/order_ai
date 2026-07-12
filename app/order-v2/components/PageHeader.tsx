"use client";

/** Order 페이지 헤더 — 다른 페이지와 동일한 title + accent bar */
export function PageHeader() {
  return (
    <header
      style={{
        paddingBottom: 16,
        marginBottom: 20,
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
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
