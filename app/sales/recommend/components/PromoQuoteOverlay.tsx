'use client';

import { useEffect, useRef, useState } from 'react';
import { shareOrDownloadFile } from '@/app/lib/shareFile';
import { roundTo100 } from '@/app/lib/priceUtils';
import {
  PromoQuoteSheet, captureNodeJpeg, fetchPromoMeta, kstToday,
  type PromoQuoteItem, type WineMeta,
} from '@/app/sales/recommend/lib/promoQuoteRender';

export type { PromoQuoteItem };

/** 추천 견적을 프로모션 상세페이지 스타일로 렌더 + 이미지 저장. 로그인 세션 안에서만 동작(공개 URL 없음).
 *  record(거래처코드·회사·담당자)가 주어지면 이미지 저장 시 saved_quotes에도 1회 기록 → 견적성과·전환에 카운트. */
export function PromoQuoteOverlay({ clientName, items, onClose, record, showSupply = true, showRate = true }: {
  clientName: string;
  items: PromoQuoteItem[];
  onClose: () => void;
  record?: { clientCode: string | null; company: 'CDV' | 'DL'; manager: string };
  showSupply?: boolean; // 견적 컬럼에 공급가(정가)가 보일 때만 정가 취소선 표기
  showRate?: boolean;   // 견적 컬럼에 할인율이 보일 때만 할인율(%) 표기
}) {
  const capRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [recorded, setRecorded] = useState(false); // 이중 카운트 방지(1회만 기록)
  const [mode, setMode] = useState<'basic' | 'story'>('basic'); // 기본(향미·가격) / 스토리(양조·빈티지·와이너리)
  const [meta, setMeta] = useState<Record<string, WineMeta>>({});

  useEffect(() => {
    fetchPromoMeta(items.map((i) => i.code)).then(setMeta);
  }, [items]);

  const today = kstToday();

  const saveImage = async () => {
    if (!capRef.current || saving) return;
    setSaving(true);
    try {
      const blob = await captureNodeJpeg(capRef.current);
      const safe = clientName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
      await shareOrDownloadFile(blob, `제안서_${today.replace(/-/g, '')}_${safe}.jpg`, 'image/jpeg');

      // 견적 이력 기록(1회) — 견적성과·전환 카운트에 잡히게. 이미지 저장 실패 시엔 기록 안 함.
      if (record && !recorded && items.length > 0) {
        try {
          const savedItems = items.map((it) => ({
            item_code: it.code,
            korean_name: it.name,
            country: it.country,
            region: it.region,
            supply_price: it.supply,
            discount_rate: it.rate,
            discounted_price: roundTo100(it.supply * (1 - (it.rate || 0))),
            quantity: it.qty || 1,
            note: it.note || '',
          }));
          const r = await fetch('/api/quote/saved', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              manager: record.manager, client_code: record.clientCode,
              client_name: clientName, company: record.company, items: savedItems,
            }),
          });
          if (r.ok) setRecorded(true);
        } catch { /* 기록 실패는 이미지 저장 자체엔 영향 없음 */ }
      }
    } catch {
      alert('이미지 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={sheet}>
        <div style={bar}>
          {/* 스타일 선택: 기본(향미·가격) / 스토리(양조·빈티지·와이너리) */}
          <div style={{ display: 'flex', border: '1px solid #d4d4d8', borderRadius: 8, overflow: 'hidden' }}>
            {(['basic', 'story'] as const).map((mo) => (
              <button key={mo} onClick={() => setMode(mo)} style={{
                padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: mode === mo ? '#222' : '#fff', color: mode === mo ? '#fff' : '#6b7280',
              }}>{mo === 'basic' ? '기본' : '스토리(노트)'}</button>
            ))}
          </div>
          <button onClick={saveImage} disabled={saving} style={{ ...btn, background: '#222', color: '#fff', border: 'none' }}>
            {saving ? '이미지 생성 중…' : '이미지로 저장'}
          </button>
          {record && recorded && (
            <span style={{ alignSelf: 'center', fontSize: 12, color: '#166534', fontWeight: 600 }}>견적 기록됨 ✓</span>
          )}
          <button onClick={onClose} style={btn}>닫기</button>
        </div>

        <div style={{ overflowY: 'auto', background: '#f4f4f5', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div ref={capRef} style={{
              width: 480, maxWidth: '100%', background: '#fff',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
            }}>
              <PromoQuoteSheet clientName={clientName} items={items} meta={meta}
                mode={mode} showSupply={showSupply} showRate={showRate} today={today} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const sheet: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: 'min(520px, 96vw)', maxHeight: '90vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};
const bar: React.CSSProperties = {
  display: 'flex', gap: 8, justifyContent: 'center', padding: '10px 16px', borderBottom: '1px solid #ebebeb',
};
const btn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid #d4d4d8', background: '#fff', color: '#374151',
};
