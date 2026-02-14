'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const WinePage = dynamic(() => import('../wine/page'), { ssr: false });
const GlassPage = dynamic(() => import('../glass/page'), { ssr: false });

type ProductTab = 'wine' | 'riedel';
type SubTab = 'order' | 'learning';

export default function OrderPage() {
  const [productTab, setProductTab] = useState<ProductTab>('wine');
  const [subTab, setSubTab] = useState<SubTab>('order');

  return (
    <div style={{ background: '#fafaf8', minHeight: 'calc(100vh - 56px)', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* Unified Tab Bar */}
      <div style={{
        background: '#fafaf8',
        borderBottom: '1px solid rgba(90,21,21,0.06)',
        position: 'sticky',
        top: 56,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '16px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left: Title + Product tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#1a1a2e',
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: '-0.01em',
          }}>
            Order
          </h1>
          <div style={{
            display: 'flex',
            background: '#F0EFED',
            borderRadius: 8,
            padding: 2,
          }}>
            {(['wine', 'riedel'] as const).map(t => (
              <div
                key={t}
                role="button"
                tabIndex={-1}
                onPointerDown={(e) => { e.preventDefault(); setProductTab(t); }}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: productTab === t ? 'white' : 'transparent',
                  color: productTab === t ? '#5A1515' : '#999',
                  boxShadow: productTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  userSelect: 'none',
                }}
              >
                {t === 'wine' ? 'Wine' : 'Riedel'}
              </div>
            ))}
          </div>
          </div>

          {/* Right: Sub tabs */}
          <div style={{
            display: 'flex',
            background: '#F0EFED',
            borderRadius: 8,
            padding: 2,
          }}>
            {(['order', 'learning'] as const).map(t => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: subTab === t ? 'white' : 'transparent',
                  color: subTab === t ? '#5A1515' : '#999',
                  boxShadow: subTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t === 'order' ? '발주 입력' : '학습 관리'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {productTab === 'wine' ? <WinePage subTab={subTab} /> : <GlassPage subTab={subTab} />}
      </div>
    </div>
  );
}
