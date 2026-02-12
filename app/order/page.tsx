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
    <div style={{ background: '#fafaf8', minHeight: 'calc(100vh - 48px)', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* Unified Tab Bar */}
      <div className="ds-subheader">
        <div className="ds-subheader-inner">
          {/* Left: Product tabs */}
          <div className="ds-tab-group">
            <div
              role="button"
              tabIndex={-1}
              className={`ds-tab${productTab === 'wine' ? ' active' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); setProductTab('wine'); }}
            >
              Wine
            </div>
            <div
              role="button"
              tabIndex={-1}
              className={`ds-tab${productTab === 'riedel' ? ' active' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); setProductTab('riedel'); }}
            >
              Riedel
            </div>
          </div>

          {/* Right: Sub tabs */}
          <div className="ds-tab-group">
            <button
              className={`ds-tab${subTab === 'order' ? ' active' : ''}`}
              onClick={() => setSubTab('order')}
            >
              발주 입력
            </button>
            <button
              className={`ds-tab${subTab === 'learning' ? ' active' : ''}`}
              onClick={() => setSubTab('learning')}
            >
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
