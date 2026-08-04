'use client';

// 와인 제안서(기본/스토리) DOM과 이미지 캡처 — PromoQuoteOverlay에서 분리한 공용 모듈.
// 오버레이(모달)와 배치·편집 패널의 이미지 발행이 같은 카드를 그대로 재사용한다.
import { createRoot } from 'react-dom/client';
import { roundTo100 } from '@/app/lib/priceUtils';
import { vintageFromCode } from '@/app/sales/recommend/lib/quoteImage';

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

export type WineMeta = {
  name_en: string; flavors: string[];
  winemaking?: string; vintage?: string; winery?: string;
  brand_code?: string; winery_name?: string; has_logo?: boolean; logo_ver?: string;
};

/** 와이너리 로고 프록시 URL — logo_ver를 붙여 로고 교체 시 브라우저 캐시 무효화 */
const logoImg = (m: WineMeta) =>
  `/api/sales/wine-img?brand=${encodeURIComponent(m.brand_code || '')}${m.logo_ver ? `&v=${m.logo_ver}` : ''}`;
const bottleImg = (code: string) => `/api/sales/wine-img?code=${encodeURIComponent(code)}`;
const won = (n: number) => n.toLocaleString('ko-KR');

export const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export async function fetchPromoMeta(codes: string[]): Promise<Record<string, WineMeta>> {
  const list = codes.filter(Boolean);
  if (list.length === 0) return {};
  try {
    const r = await fetch('/api/sales/promo-quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes: list }),
    });
    return (await r.json())?.map || {};
  } catch { return {}; }
}

/** 제안서 본문 — 캡처 대상 DOM (오버레이·오프스크린 공용) */
export function PromoQuoteSheet({ clientName, items, meta, mode, showSupply, showRate, today }: {
  clientName: string;
  items: PromoQuoteItem[];
  meta: Record<string, WineMeta>;
  mode: 'basic' | 'story';
  showSupply: boolean;
  showRate: boolean;
  today: string;
}) {
  return (
    <>
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
          ? <StoryCard key={it.code || i} it={it} m={meta[it.code]} last={i === items.length - 1} showSupply={showSupply} showRate={showRate} />
          : <BasicCard key={it.code || i} it={it} m={meta[it.code]} last={i === items.length - 1} showSupply={showSupply} showRate={showRate} />
      ))}

      <div style={{ padding: '24px 24px 38px', textAlign: 'center', borderTop: '1px solid #ebebeb' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111', letterSpacing: '0.06em' }}>(주)까브드뱅</div>
        <div style={{ fontSize: 11.5, color: '#8a8a8a', marginTop: 4, lineHeight: 1.7 }}>
          TEL 02-780-9441 · www.cavedevin.com<br />
          가격은 공급가(VAT 별도) 기준입니다.
        </div>
      </div>
    </>
  );
}

/** DOM 노드 → JPEG Blob. 이미지 인라인(섞임 방지) + Safari SVG 다중 드로우 우회 포함. */
export async function captureNodeJpeg(el: HTMLElement): Promise<Blob> {
  const imgs = Array.from(el.querySelectorAll('img'));
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

  const { toJpeg, toSvg } = await import('html-to-image');
  const isSafari = typeof navigator !== 'undefined'
    && /iP(hone|ad|od)|^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  let dataUrl: string;
  if (isSafari) {
    const w = el.offsetWidth, h = el.scrollHeight;
    const ratio = Math.min(3, Math.sqrt(16_000_000 / Math.max(1, w * h)));
    const svgUrl = await toSvg(el, { backgroundColor: '#ffffff', skipFonts: true });
    const img = new Image();
    img.src = svgUrl;
    await img.decode().catch(() => new Promise((r) => { img.onload = r; img.onerror = r; }));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 350));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    dataUrl = canvas.toDataURL('image/jpeg', 0.98);
  } else {
    dataUrl = await toJpeg(el, { quality: 0.98, pixelRatio: 3, backgroundColor: '#ffffff', skipFonts: true });
  }
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

/** 오프스크린 렌더 → 제안서 JPEG (배치·편집 패널 발행용). 모달 없이 동일 카드 재사용. */
export async function renderPromoQuoteJpeg(opts: {
  clientName: string;
  items: PromoQuoteItem[];
  mode?: 'basic' | 'story';
  showSupply?: boolean;
  showRate?: boolean;
}): Promise<Blob> {
  const meta = await fetchPromoMeta(opts.items.map((i) => i.code));
  // 오프스크린 이동은 바깥 host에만 — 캡처 대상(inner)은 일반 배치여야 함.
  // (fixed/-10000px가 캡처 노드에 있으면 html-to-image 복제본에서 내용이 캔버스 밖으로 밀려 백지가 됨)
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(
      <div style={{
        width: 480, background: '#fff',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
      }}>
        <PromoQuoteSheet clientName={opts.clientName} items={opts.items} meta={meta}
          mode={opts.mode || 'story'} showSupply={opts.showSupply ?? true} showRate={opts.showRate ?? true}
          today={kstToday()} />
      </div>,
    );
    await new Promise((r) => setTimeout(r, 150)); // 렌더 정착 (이미지는 캡처 단계에서 인라인)
    const inner = host.firstElementChild as HTMLElement | null;
    if (!inner) throw new Error('제안서 렌더 실패');
    return await captureNodeJpeg(inner);
  } finally {
    root.unmount();
    host.remove();
  }
}

/** 가격 라인(공통) — 견적 컬럼에서 숨긴 항목(공급가 취소선·할인율)은 프로모션에서도 생략.
 *  공급가가 아예 없으면(supply=0) 가격 표기 전체 생략. */
function PriceLine({ it, showSupply, showRate }: { it: PromoQuoteItem; showSupply: boolean; showRate: boolean }) {
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
        {showSupply && it.supply > promo && (
          <span style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{won(it.supply)}원</span>
        )}
        <span style={{ fontSize: 22, fontWeight: 700, color: '#b23b1c', fontVariantNumeric: 'tabular-nums' }}>{won(promo)}원</span>
        {showRate && pct > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#b23b1c' }}>{pct}%↓</span>}
      </div>
      {it.qty > 1 && (
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>{it.qty}병 기준</div>
      )}
      {it.note && <div style={{ textAlign: 'center', marginTop: it.qty > 1 ? 3 : 8, fontSize: 12, color: '#6b7280' }}>{it.note}</div>}
    </>
  );
}

/** 기본 스타일 — 병샷 · 향미칩 · 가격 */
function BasicCard({ it, m, last, showSupply, showRate }: { it: PromoQuoteItem; m?: WineMeta; last: boolean; showSupply: boolean; showRate: boolean }) {
  return (
    <div style={{ padding: '28px 24px', borderBottom: last ? 'none' : '1px solid #ebebeb' }}>
      {m?.has_logo && m.brand_code && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoImg(m)} alt={m.winery_name || ''}
            crossOrigin="anonymous" style={{ height: 'auto', width: 'auto', maxHeight: 74, maxWidth: 210, objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      {m?.winery_name && (
        <div style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.05em', color: '#8a6a48', fontWeight: 700, marginBottom: 8 }}>
          {m.winery_name}
        </div>
      )}
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        {it.code ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bottleImg(it.code)} alt={it.name} crossOrigin="anonymous"
            style={{ height: 280, width: 'auto', maxWidth: 320, objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : <div style={{ fontSize: 40, opacity: 0.15 }}>🍷</div>}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>{it.name}</div>
        {(m?.name_en || vintageFromCode(it.code)) && (
          <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3 }}>
            {[m?.name_en, vintageFromCode(it.code)].filter(Boolean).join(' ')}
          </div>
        )}
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
      <PriceLine it={it} showSupply={showSupply} showRate={showRate} />
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
function StoryCard({ it, m, last, showSupply, showRate }: { it: PromoQuoteItem; m?: WineMeta; last: boolean; showSupply: boolean; showRate: boolean }) {
  const hasStory = !!(m?.winery || m?.winemaking || m?.vintage);
  return (
    <div style={{ padding: '10px 0 24px', borderBottom: last ? 'none' : '1px solid #ebebeb' }}>
      {m?.has_logo && m.brand_code && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 4px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoImg(m)} alt={m.winery_name || ''}
            crossOrigin="anonymous" style={{ height: 'auto', width: 'auto', maxHeight: 74, maxWidth: 210, objectFit: 'contain' }}
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
        {(m?.name_en || vintageFromCode(it.code)) && (
          <div style={{ fontSize: 12, color: '#b0a08f', marginTop: 4 }}>
            {[m?.name_en, vintageFromCode(it.code)].filter(Boolean).join(' ')}
          </div>
        )}
        {(it.country || it.region) && (
          <div style={{ fontSize: 12.5, color: '#7a6a5a', marginTop: 6 }}>{[it.country, it.region].filter(Boolean).join(' · ')}</div>
        )}
      </div>
      <PriceLine it={it} showSupply={showSupply} showRate={showRate} />
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
