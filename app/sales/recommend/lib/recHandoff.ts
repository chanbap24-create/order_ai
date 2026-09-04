// 다른 탭(알림 대체추천 등) → 추천견적 탭 핸드오프.
// sessionStorage 1회성 전달: 거래처 + 기준상품(앵커)을 싣고 '대체 상품' 모드로 자동 진입.
import type { AnchorItem } from '../components/RecModeSelector';

const KEY = 'rec-handoff';

export type RecHandoff = {
  client: { client_code: string; client_name: string; business_type?: string; manager?: string };
  anchor: { item_code: string; name: string; price: number };
  ts: number;
};

export function setRecHandoff(h: Omit<RecHandoff, 'ts'>) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...h, ts: Date.now() })); } catch { /* ignore */ }
}

// dev StrictMode 이중 마운트에서 두 번 읽혀도 같은 값을 돌려주기 위한 짧은 캐시
let lastConsumed: { v: RecHandoff; at: number } | null = null;

/** 읽는 즉시 소모(1회성). 5분 지난 핸드오프는 무시. */
export function consumeRecHandoff(): RecHandoff | null {
  try {
    if (lastConsumed && Date.now() - lastConsumed.at < 3000) return lastConsumed.v;
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const h = JSON.parse(raw) as RecHandoff;
    if (!h?.client?.client_code || !h?.anchor?.item_code) return null;
    if (Date.now() - (h.ts || 0) > 5 * 60_000) return null;
    lastConsumed = { v: h, at: Date.now() };
    return h;
  } catch { return null; }
}

export function anchorFromHandoff(h: RecHandoff): AnchorItem {
  return { item_code: h.anchor.item_code, name: h.anchor.name, price: h.anchor.price, region: '', wine_type: '', count: 0, last: '' };
}
