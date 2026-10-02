'use client';

// 매장 앱 메뉴(⋮⋮⋮) — 구글 앱 메뉴처럼 타일 패널. PC=버튼 아래 팝오버, 768px 이하=바텀시트(디자인 규칙).
import type { ReactNode } from 'react';

export type AppsMenuItem = { key: string; label: string; sub?: string; icon: ReactNode; active?: boolean; onClick: () => void };

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** 메뉴 타일 아이콘 — 단색 선 아이콘(브랜드 톤 유지) */
export const MenuIcons = {
  stock: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M4 8l8-4 8 4-8 4-8-4z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" /></svg>,
  incoming: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></svg>,
  arrivals: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M9 15l2 2 4-4" /></svg>,
  sommelier: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M8 3h8l-.5 5a3.5 3.5 0 0 1-7 0L8 3z" /><path d="M12 11.5V20M8.5 20h7" /></svg>,
  store: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M4 10l1.5-5h13L20 10" /><path d="M4 10h16v1a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 11v-1z" /><path d="M5.5 13v7h13v-7" /></svg>,
};

export function AppsMenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-label="메뉴" aria-expanded={open}
      style={{
        all: 'unset', cursor: 'pointer', width: 40, height: 40, borderRadius: '50%', flex: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: open ? 'var(--surface-active)' : 'transparent', transition: 'background 0.15s ease',
      }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />))}
      </svg>
    </button>
  );
}

export function AppsMenu({ open, onClose, items }: { open: boolean; onClose: () => void; items: AppsMenuItem[] }) {
  if (!open) return null;
  return (
    <>
      <style>{`
        .apps-menu { position: absolute; top: 48px; right: 0; width: 320px; z-index: 50; }
        @media (max-width: 768px) {
          .apps-menu { position: fixed; top: auto; left: 0; right: 0; bottom: 0; width: auto;
            border-radius: 12px 12px 0 0 !important; padding-bottom: calc(20px + env(safe-area-inset-bottom)) !important; }
        }
      `}</style>
      {/* 바깥 탭 = 닫기 */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'color-mix(in srgb, var(--action) 12%, transparent)' }} />
      <div className="apps-menu" role="menu"
        style={{
          background: 'var(--surface)', borderRadius: 12, padding: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid var(--border-subtle)',
        }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {items.map((it) => (
            <button key={it.key} role="menuitem" onClick={() => { it.onClick(); onClose(); }}
              style={{
                all: 'unset', cursor: 'pointer', boxSizing: 'border-box', borderRadius: 10, padding: '14px 4px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center',
                background: it.active ? 'var(--surface-muted)' : 'transparent',
              }}>
              <span style={{
                width: 44, height: 44, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-muted)', color: 'var(--text-primary)',
              }}>
                {it.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: it.active ? 700 : 500, color: 'var(--text-primary)' }}>{it.label}</span>
              {it.sub && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', marginTop: -3 }}>{it.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
