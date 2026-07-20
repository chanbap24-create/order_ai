'use client';

import { useRef, useState } from 'react';
import { shareOrDownloadFile } from '@/app/lib/shareFile';
import type { PromoPageData, PromoPageItem } from '@/app/lib/promoPage';

const won = (n: number) => n.toLocaleString('ko-KR');

/** 이달의 프로모션 상세페이지 — 모바일 세로형. [이미지로 저장]은 캡처 영역만 긴 JPG로. */
export function PromoClient({ data }: { data: PromoPageData }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveImage = async () => {
    if (!captureRef.current || saving) return;
    setSaving(true);
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(captureRef.current, {
        quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true,
        // 교차 출처 폰트 CSS(cssRules) 접근이 SecurityError를 던져 폰트 임베드는 건너뜀 —
        // 캡처 루트에 시스템 폰트를 명시해 렌더 결과는 동일하게 유지
        skipFonts: true,
      });
      // fetch(data:)는 CSP connect-src에 막힘 → base64 직접 변환
      const bin = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const m = data.month.match(/(\d{4})년 (\d{1,2})월/);
      const stamp = m ? `${m[1]}${m[2].padStart(2, '0')}` : data.month.replace(/[^0-9]/g, '');
      await shareOrDownloadFile(blob, `프로모션_${stamp}.jpg`, 'image/jpeg');
    } catch (e) {
      console.error('promo capture failed:', e);
      alert('이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ background: '#f4f4f5', minHeight: '100dvh', wordBreak: 'keep-all' }}>
      {/* 액션 바 — 캡처에 포함되지 않음 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 8, justifyContent: 'center',
        padding: '10px 16px', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(6px)',
        borderBottom: '1px solid #ebebeb',
      }}>
        <button onClick={saveImage} disabled={saving} style={{ ...btn, background: '#222', color: '#fff', border: 'none' }}>
          {saving ? '이미지 생성 중…' : '이미지로 저장 (카톡 전송용)'}
        </button>
        <button onClick={copyLink} style={btn}>{copied ? '복사됨 ✓' : '링크 복사'}</button>
      </div>

      {/* ── 캡처 영역 ── */}
      <div ref={captureRef} style={{
        maxWidth: 480, margin: '0 auto', background: '#fff',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
      }}>
        {/* 히어로 */}
        <div style={{ padding: '44px 24px 30px', textAlign: 'center', borderBottom: '1px solid #ebebeb' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.35em', color: '#8a8a8a', fontWeight: 600 }}>CAVE DE VIN</div>
          <h1 style={{ fontSize: 27, fontWeight: 700, margin: '12px 0 6px', letterSpacing: '-0.02em', color: '#111' }}>
            이달의 프로모션
          </h1>
          <div style={{ fontSize: 14, color: '#6b7280' }}>{data.month} · {data.items.length}종 한정</div>
        </div>

        {data.items.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            진행 중인 프로모션이 없습니다.
          </div>
        )}

        {data.items.map((it, i) => <PromoCard key={it.item_no} it={it} last={i === data.items.length - 1} />)}

        {/* 푸터 */}
        <div style={{ padding: '26px 24px 40px', textAlign: 'center', borderTop: '1px solid #ebebeb' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', letterSpacing: '0.06em' }}>(주)까브드뱅</div>
          <div style={{ fontSize: 11.5, color: '#8a8a8a', marginTop: 4, lineHeight: 1.7 }}>
            TEL 02-780-9441 · www.cavedevin.com<br />
            가격은 공급가(VAT 별도) 기준이며, 재고 소진 시 조기 종료될 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoCard({ it, last }: { it: PromoPageItem; last: boolean }) {
  const rate = it.supply_price > 0 ? Math.round((1 - it.promo_price / it.supply_price) * 100) : 0;
  return (
    <div style={{ padding: '30px 24px', borderBottom: last ? 'none' : '1px solid #ebebeb' }}>
      {/* 병샷 */}
      <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        {it.has_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/promo/img?item=${encodeURIComponent(it.item_no)}`}
            alt={it.name_kr}
            crossOrigin="anonymous"
            style={{ maxHeight: '100%', maxWidth: '70%', objectFit: 'contain' }}
          />
        ) : (
          <div style={{ fontSize: 44, opacity: 0.15 }}>🍷</div>
        )}
      </div>

      {/* 이름·산지 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17.5, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>{it.name_kr}</div>
        {it.name_en && <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3 }}>{it.name_en}</div>}
        {(it.country || it.region) && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            {[it.country, it.region].filter(Boolean).join(' · ')}
          </div>
        )}
        {it.flavors.length > 0 && (
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            {it.flavors.map((f) => (
              <span key={f} style={{ fontSize: 11, color: '#6b7280', border: '1px solid #ebebeb', borderRadius: 999, padding: '2px 9px' }}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 가격 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginTop: 16 }}>
        {it.supply_price > it.promo_price && (
          <span style={{ fontSize: 13.5, color: '#9ca3af', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
            {won(it.supply_price)}원
          </span>
        )}
        <span style={{ fontSize: 23, fontWeight: 700, color: '#b23b1c', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          {won(it.promo_price)}원
        </span>
        {rate > 0 && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#b23b1c' }}>{rate}%↓</span>
        )}
      </div>
      {(it.quantity || it.memo) && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#6b7280' }}>
          {[it.quantity ? `${it.quantity}병 구성` : '', it.memo].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid #d4d4d8', background: '#fff', color: '#374151',
};
