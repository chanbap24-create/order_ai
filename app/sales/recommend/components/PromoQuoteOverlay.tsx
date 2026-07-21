'use client';

import { useEffect, useRef, useState } from 'react';
import { shareOrDownloadFile } from '@/app/lib/shareFile';
import { roundTo100 } from '@/app/lib/priceUtils';

export type PromoQuoteItem = {
  code: string;
  name: string;
  country: string;
  region: string;
  supply: number;   // 정상 공급가
  rate: number;     // 할인율 0~1
  qty: number;
  note: string;
};

type WineMeta = {
  name_en: string; flavors: string[];
  winemaking?: string; vintage?: string; winery?: string;
  brand_code?: string; winery_name?: string; has_logo?: boolean;
};

const won = (n: number) => n.toLocaleString('ko-KR');

/** 추천 견적을 프로모션 상세페이지 스타일로 렌더 + 이미지 저장. 로그인 세션 안에서만 동작(공개 URL 없음).
 *  record(거래처코드·회사·담당자)가 주어지면 이미지 저장 시 saved_quotes에도 1회 기록 → 견적성과·전환에 카운트. */
export function PromoQuoteOverlay({ clientName, items, onClose, record }: {
  clientName: string;
  items: PromoQuoteItem[];
  onClose: () => void;
  record?: { clientCode: string | null; company: 'CDV' | 'DL'; manager: string };
}) {
  const capRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [recorded, setRecorded] = useState(false); // 이중 카운트 방지(1회만 기록)
  const [mode, setMode] = useState<'basic' | 'story'>('basic'); // 기본(향미·가격) / 스토리(양조·빈티지·와이너리)
  const [meta, setMeta] = useState<Record<string, WineMeta>>({});

  useEffect(() => {
    const codes = items.map((i) => i.code).filter(Boolean);
    if (codes.length === 0) return;
    fetch('/api/sales/promo-quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes }),
    }).then((r) => r.json()).then((j) => setMeta(j.map || {})).catch(() => {});
  }, [items]);

  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const saveImage = async () => {
    if (!capRef.current || saving) return;
    setSaving(true);
    try {
      // 각 이미지를 미리 data URL로 인라인 — html-to-image가 내부적으로 이미지를 가져오는 과정에서
      // 로고/병샷이 섞이거나 첫 이미지로 통일되던 문제(화면≠다운로드)를 원천 차단.
      const imgs = Array.from(capRef.current.querySelectorAll('img'));
      await Promise.all(imgs.map(async (img) => {
        try {
          const src = img.getAttribute('src') || '';
          if (src.startsWith('data:')) return;
          const res = await fetch(src);
          if (!res.ok) return;
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          });
          img.src = dataUrl;
          await img.decode().catch(() => {});
        } catch { /* 실패한 이미지는 onError로 숨겨짐 */ }
      }));

      const { toJpeg } = await import('html-to-image');
      // 이미지를 이미 인라인했으니 cacheBust·중복 렌더 불필요(그게 섞임의 원인이었음)
      const dataUrl = await toJpeg(capRef.current, {
        quality: 0.98, pixelRatio: 3, backgroundColor: '#ffffff', skipFonts: true,
      });
      const bin = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
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
              {mode === 'story' ? (
                <div style={{ padding: '38px 30px 24px', textAlign: 'center', background: '#3a2a22', color: '#fff' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.4em', color: '#c9b79c', fontWeight: 600 }}>CAVE DE VIN</div>
                  <h1 style={{ fontSize: 23, fontWeight: 700, margin: '10px 0 5px', letterSpacing: '-0.01em' }}>와인 제안서</h1>
                  <div style={{ fontSize: 12.5, color: '#d8cbbb' }}>{clientName} · {items.length}종 · {today}</div>
                </div>
              ) : (
                <div style={{ padding: '40px 24px 26px', textAlign: 'center', borderBottom: '1px solid #ebebeb' }}>
                  <div style={{ fontSize: 12, letterSpacing: '0.35em', color: '#8a8a8a', fontWeight: 600 }}>CAVE DE VIN</div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, margin: '12px 0 6px', letterSpacing: '-0.02em', color: '#111' }}>와인 제안서</h1>
                  <div style={{ fontSize: 13.5, color: '#6b7280' }}>{clientName} · {items.length}종 · {today}</div>
                </div>
              )}

              {items.map((it, i) => (
                mode === 'story'
                  ? <StoryCard key={it.code || i} it={it} m={meta[it.code]} last={i === items.length - 1} />
                  : <BasicCard key={it.code || i} it={it} m={meta[it.code]} last={i === items.length - 1} />
              ))}

              <div style={{ padding: '24px 24px 38px', textAlign: 'center', borderTop: '1px solid #ebebeb' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', letterSpacing: '0.06em' }}>(주)까브드뱅</div>
                <div style={{ fontSize: 11.5, color: '#8a8a8a', marginTop: 4, lineHeight: 1.7 }}>
                  TEL 02-780-9441 · www.cavedevin.com<br />
                  가격은 공급가(VAT 별도) 기준입니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const bottleImg = (code: string) => `/api/sales/wine-img?code=${encodeURIComponent(code)}`;

/** 가격 라인(공통) — 공급가가 없으면(견적 컬럼 미기입) 가격/할인 표기 자체를 생략. */
function PriceLine({ it }: { it: PromoQuoteItem }) {
  if (!(it.supply > 0)) {
    return it.note
      ? <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#6b7280' }}>{it.note}</div>
      : null;
  }
  const promo = roundTo100(it.supply * (1 - (it.rate || 0)));
  const pct = it.supply > 0 ? Math.round((1 - promo / it.supply) * 100) : 0;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginTop: 16 }}>
        {it.supply > promo && (
          <span style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{won(it.supply)}원</span>
        )}
        <span style={{ fontSize: 22, fontWeight: 700, color: '#b23b1c', fontVariantNumeric: 'tabular-nums' }}>{won(promo)}원</span>
        {pct > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#b23b1c' }}>{pct}%↓</span>}
      </div>
      {it.qty > 1 && (
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>{it.qty}병 기준</div>
      )}
      {it.note && <div style={{ textAlign: 'center', marginTop: it.qty > 1 ? 3 : 8, fontSize: 12, color: '#6b7280' }}>{it.note}</div>}
    </>
  );
}

/** 기본 스타일 — 병샷 · 향미칩 · 가격 */
function BasicCard({ it, m, last }: { it: PromoQuoteItem; m?: WineMeta; last: boolean }) {
  return (
    <div style={{ padding: '28px 24px', borderBottom: last ? 'none' : '1px solid #ebebeb' }}>
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        {it.code ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bottleImg(it.code)} alt={it.name} crossOrigin="anonymous"
            style={{ height: 200, width: 'auto', maxWidth: 300, objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : <div style={{ fontSize: 40, opacity: 0.15 }}>🍷</div>}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>{it.name}</div>
        {m?.name_en && <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3 }}>{m.name_en}</div>}
        {(it.country || it.region) && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{[it.country, it.region].filter(Boolean).join(' · ')}</div>
        )}
        {(m?.flavors?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            {m!.flavors.map((f) => (
              <span key={f} style={{ fontSize: 11, color: '#6b7280', border: '1px solid #ebebeb', borderRadius: 999, padding: '2px 9px' }}>{f}</span>
            ))}
          </div>
        )}
      </div>
      <PriceLine it={it} />
    </div>
  );
}

/** 노트 섹션(라벨 + 본문) — 내용 없으면 렌더 안 함 */
function Sec({ label, text }: { label: string; text?: string }) {
  if (!text || !text.trim()) return null;
  return (
    <div style={{ padding: '20px 30px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
        <span style={{ flex: 1, height: 1, background: '#e6ddd0' }} />
        <span style={{ fontSize: 11, letterSpacing: '0.2em', color: '#9a7a52', fontWeight: 700 }}>{label}</span>
        <span style={{ flex: 1, height: 1, background: '#e6ddd0' }} />
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.7, color: '#4a3f34' }}>{text.trim()}</div>
    </div>
  );
}

/** 스토리 스타일 — 와이너리 로고 · 와이너리 · 양조 · 빈티지 */
function StoryCard({ it, m, last }: { it: PromoQuoteItem; m?: WineMeta; last: boolean }) {
  const hasStory = !!(m?.winery || m?.winemaking || m?.vintage);
  return (
    <div style={{ padding: '10px 0 24px', borderBottom: last ? 'none' : '1px solid #ebebeb' }}>
      {m?.has_logo && m.brand_code && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 4px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/sales/wine-img?brand=${encodeURIComponent(m.brand_code)}`} alt={m.winery_name || ''}
            crossOrigin="anonymous" style={{ height: 52, width: 'auto', maxWidth: 240, objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      {m?.winery_name && (
        <div style={{ textAlign: 'center', fontSize: 12.5, letterSpacing: '0.05em', color: '#8a6a48', fontWeight: 700, marginTop: 4 }}>
          {m.winery_name}
        </div>
      )}
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 4px' }}>
        {it.code ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bottleImg(it.code)} alt={it.name} crossOrigin="anonymous"
            style={{ height: 280, width: 'auto', maxWidth: 320, objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : <div style={{ fontSize: 40, opacity: 0.15 }}>🍷</div>}
      </div>
      <div style={{ textAlign: 'center', padding: '0 26px' }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#241a14', letterSpacing: '-0.01em' }}>{it.name}</div>
        {m?.name_en && <div style={{ fontSize: 12, color: '#b0a08f', marginTop: 4 }}>{m.name_en}</div>}
        {(it.country || it.region) && (
          <div style={{ fontSize: 12.5, color: '#7a6a5a', marginTop: 6 }}>{[it.country, it.region].filter(Boolean).join(' · ')}</div>
        )}
      </div>
      <PriceLine it={it} />
      <Sec label="WINERY · 와이너리" text={m?.winery} />
      <Sec label="VINIFICATION · 양조" text={m?.winemaking} />
      <Sec label="VINTAGE · 빈티지" text={m?.vintage} />
      {!hasStory && (
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11.5, color: '#b0a08f' }}>
          · 이 와인은 상세 노트(양조·빈티지·와이너리)가 아직 없어요 ·
        </div>
      )}
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
