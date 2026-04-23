import { extractGrapesFromName, extractTypeFromName } from './constants';
import type {
  ClientAgg, ClientPreference, ShipmentRow, WineMeta, InvInfo,
} from './types';

/**
 * shipments → 거래처별 집계 (shipments/items) + 거래처×품목 구매일 맵.
 */
export function buildClientAggregates(allShipments: ShipmentRow[]) {
  const clientMap = new Map<string, ClientAgg>();
  const clientItemDates = new Map<string, { dates: string[]; totalQty: number }>();

  for (const s of allShipments) {
    const code = s.client_code;
    if (!code) continue;
    if (!clientMap.has(code)) {
      clientMap.set(code, {
        client_name: s.client_name || code,
        shipments: [],
        items: new Map(),
        total_amount: 0,
      });
    }
    const agg = clientMap.get(code)!;
    if (!agg.client_name && s.client_name) agg.client_name = s.client_name;
    const date = s.ship_date?.toString().slice(0, 10) || '';
    const amt = s.total_amount || 0;
    agg.shipments.push({ date, amount: amt });
    agg.total_amount += amt;

    if (s.item_no) {
      const existing = agg.items.get(s.item_no);
      if (existing) {
        existing.qty += (s.quantity || 1);
      } else {
        agg.items.set(s.item_no, { name: s.item_name || s.item_no, qty: s.quantity || 1 });
      }

      if (date) {
        const key = `${code}||${s.item_no}`;
        if (!clientItemDates.has(key)) {
          clientItemDates.set(key, { dates: [], totalQty: 0 });
        }
        const cid = clientItemDates.get(key)!;
        cid.dates.push(date);
        cid.totalQty += (s.quantity || 1);
      }
    }
  }

  return { clientMap, clientItemDates };
}

/**
 * wines 메타 + inventory_cdv 재고 맵 구축 (upsell/new_arrival/season 공용).
 */
export function buildMetaMaps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allWines: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allInv: any[],
) {
  const wineMetaMap = new Map<string, WineMeta>();
  const fullInvMap = new Map<string, InvInfo>();

  for (const w of allWines) {
    const grapes = w.grape_varieties
      ? String(w.grape_varieties).split(/[,\/]/).map((g: string) => g.trim()).filter(Boolean)
      : extractGrapesFromName(w.item_name_kr || '');
    const wType = w.wine_type || extractTypeFromName(w.item_name_kr || '');
    wineMetaMap.set(w.item_code, { country: w.country || '', grapes, wineType: wType });
  }
  for (const d of allInv) {
    fullInvMap.set(d.item_no, {
      item_name: d.item_name || d.item_no,
      supply_price: d.supply_price || 0,
      available_stock: d.available_stock || 0,
    });
  }

  return { wineMetaMap, fullInvMap };
}

/**
 * 거래처별 취향 프로필 (new_arrival + season + upsell 공용).
 */
export function buildClientPrefs(
  allShipments: ShipmentRow[],
  wineMetaMap: Map<string, WineMeta>,
) {
  const clientPrefs = new Map<string, ClientPreference>();

  for (const s of allShipments) {
    const code = s.client_code;
    if (!code) continue;
    if (!clientPrefs.has(code)) {
      clientPrefs.set(code, {
        countryCount: new Map(),
        grapeCount: new Map(),
        typeCount: new Map(),
        totalAmount: 0,
        totalOrders: 0,
      });
    }
    const pref = clientPrefs.get(code)!;
    pref.totalAmount += (s.total_amount || 0);
    pref.totalOrders += 1;

    if (s.item_no) {
      const meta = wineMetaMap.get(s.item_no);
      if (meta) {
        if (meta.country) {
          pref.countryCount.set(meta.country, (pref.countryCount.get(meta.country) || 0) + 1);
        }
        for (const g of meta.grapes) {
          pref.grapeCount.set(g, (pref.grapeCount.get(g) || 0) + 1);
        }
        if (meta.wineType) {
          pref.typeCount.set(meta.wineType, (pref.typeCount.get(meta.wineType) || 0) + 1);
        }
      } else {
        const grapes = extractGrapesFromName(s.item_name || '');
        for (const g of grapes) {
          pref.grapeCount.set(g, (pref.grapeCount.get(g) || 0) + 1);
        }
        const t = extractTypeFromName(s.item_name || '');
        if (t) {
          pref.typeCount.set(t, (pref.typeCount.get(t) || 0) + 1);
        }
      }
    }
  }

  return clientPrefs;
}
