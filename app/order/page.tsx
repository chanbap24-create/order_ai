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

  const pillActive = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 7,
    border: 'none',
    background: active ? '#8B1538' : 'transparent',
    color: active ? '#fff' : '#666',
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
  } as React.CSSProperties);

  return (
    <div>
      {/* Unified Tab Bar */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #eee',
        position: 'sticky',
        top: 80,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          {/* Left: Product tabs (WINE / RIEDEL) */}
          <div style={{
            display: 'flex',
            gap: 3,
            background: '#f3f4f6',
            padding: 3,
            borderRadius: 10,
          }}>
            <button onClick={() => setProductTab('wine')} style={pillActive(productTab === 'wine')}>
              WINE
            </button>
            <button onClick={() => setProductTab('riedel')} style={pillActive(productTab === 'riedel')}>
              RIEDEL
            </button>
          </div>

          {/* Right: Sub tabs (발주 입력 / 학습 관리) */}
          <div style={{
            display: 'flex',
            gap: 3,
            background: '#f3f4f6',
            padding: 3,
            borderRadius: 10,
          }}>
            <button onClick={() => setSubTab('order')} style={pillActive(subTab === 'order')}>
              발주 입력
            </button>
            <button onClick={() => setSubTab('learning')} style={pillActive(subTab === 'learning')}>
              학습 관리
            </button>
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
