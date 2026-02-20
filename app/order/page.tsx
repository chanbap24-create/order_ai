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
    <div style={{
      background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
      minHeight: 'calc(100vh - 56px)',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      {/* Refined Tab Bar */}
      <div style={{
        background: 'rgba(250,249,247,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(90,21,21,0.06)',
        position: 'sticky',
        top: 56,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '12px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          {/* Left: Title + Product tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#2c1810',
              margin: 0,
              fontFamily: "'Cormorant Garamond', serif",
              letterSpacing: '0.02em',
            }}>
              Order
            </h1>

            {/* Product Toggle */}
            <div style={{
              display: 'flex',
              background: 'rgba(90,21,21,0.05)',
              borderRadius: 10,
              padding: 3,
              gap: 2,
            }}>
              {(['wine', 'riedel'] as const).map(t => {
                const isActive = productTab === t;
                return (
                  <div
                    key={t}
                    role="button"
                    tabIndex={-1}
                    onPointerDown={(e) => { e.preventDefault(); setProductTab(t); }}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: isActive ? '#fff' : 'transparent',
                      color: isActive ? '#5A1515' : '#8a8580',
                      boxShadow: isActive
                        ? '0 1px 4px rgba(90,21,21,0.1), 0 0 0 1px rgba(90,21,21,0.04)'
                        : 'none',
                      userSelect: 'none',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t === 'wine' ? 'Wine' : 'Riedel'}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Sub tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(90,21,21,0.05)',
            borderRadius: 10,
            padding: 3,
            gap: 2,
          }}>
            {(['order', 'learning'] as const).map(t => {
              const isActive = subTab === t;
              return (
                <button
                  key={t}
                  onClick={() => setSubTab(t)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#5A1515' : '#8a8580',
                    boxShadow: isActive
                      ? '0 1px 4px rgba(90,21,21,0.1), 0 0 0 1px rgba(90,21,21,0.04)'
                      : 'none',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t === 'order' ? '발주' : '학습'}
                </button>
              );
            })}
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
