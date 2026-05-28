/**
 * quote_items 추가 로직. POST /api/quote 진입점에서 호출.
 *
 * 기존 순차 7회 Supabase RTT 를 Promise.all 로 묶어 ~100~200ms 수준으로 단축.
 *
 *  Phase 1 (병렬): wines / inventory_cdv / tasting_notes / 중복체크 / sort_order
 *  Phase 2 (조건부): CDV 에 retail_price 없을 때만 inventory_dl fallback
 *  Phase 3: 중복이면 quantity 합산 update, 아니면 insert
 */

import { supabase } from '@/app/lib/db';
import { extractVintage, removePrefix } from './enrichment';

type Body = {
  item_code?: string;
  country?: string;
  brand?: string;
  region?: string;
  image_url?: string;
  vintage?: string;
  product_name?: string;
  english_name?: string;
  korean_name?: string;
  supply_price?: number | string;
  min_price?: number | string;
  retail_price?: number | string;
  discount_rate?: number | string;
  quantity?: number | string;
  note?: string;
  tasting_note?: string;
  manager?: string;
};

export async function addQuoteItem(body: Body) {
  const {
    item_code = '',
    quantity = 1,
    manager = '',
  } = body;

  let country = body.country ?? '';
  let brand = body.brand ?? '';
  let region = body.region ?? '';
  let image_url = body.image_url ?? '';
  let vintage = body.vintage ?? '';
  let product_name = body.product_name ?? '';
  let english_name = body.english_name ?? '';
  let korean_name = body.korean_name ?? '';
  let retail_price: number | string = body.retail_price ?? 0;
  let min_price: number | string = body.min_price ?? 0;
  let tasting_note = body.tasting_note ?? '';
  let spec = '';
  const supply_price = body.supply_price ?? 0;
  const discount_rate = body.discount_rate ?? 0;
  const note = body.note ?? '';
  let supplierKr = '';

  // Phase 1: 최대 5개 쿼리 병렬 실행
  const dupQueryFn = () => {
    let q = supabase.from('quote_items').select('id, quantity').eq('item_code', item_code);
    if (manager) q = q.eq('manager', manager);
    return q.maybeSingle();
  };
  const sortQueryFn = () => {
    let q = supabase.from('quote_items').select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    if (manager) q = q.eq('manager', manager);
    return q.maybeSingle();
  };

  if (item_code) {
    const [wineRes, cdvRes, tnRes, dupRes, sortRes] = await Promise.all([
      supabase.from('wines')
        .select('item_name_en, item_name_kr, country, country_en, region, supplier, supplier_kr, brand, image_url')
        .eq('item_code', item_code)
        .maybeSingle(),
      (!retail_price || !min_price)
        ? supabase.from('inventory_cdv')
            .select('retail_price, min_price')
            .eq('item_no', item_code)
            .maybeSingle()
        : Promise.resolve({ data: null as { retail_price?: number; min_price?: number } | null }),
      !tasting_note
        ? supabase.from('tasting_notes')
            .select('color_note, nose_note, palate_note')
            .eq('wine_id', item_code)
            .maybeSingle()
        : Promise.resolve({ data: null as { color_note?: string; nose_note?: string; palate_note?: string } | null }),
      dupQueryFn(),
      sortQueryFn(),
    ]);

    // wines 보강
    const wine = wineRes.data;
    if (wine) {
      // brand: supplier(풀네임) 우선 — wine.brand 는 보통 2~3자 약어(LM, FL, PF 등)
      // brand 비었거나 짧은 약어(≤3자)면 supplier 풀네임으로 덮어씀
      if (!brand || (brand.length <= 3 && wine.supplier)) {
        brand = wine.supplier || wine.brand || '';
      }
      if (!english_name) english_name = wine.item_name_en || '';
      if (!korean_name) korean_name = wine.item_name_kr || '';
      if (!region) region = wine.region || '';
      if (!country) country = wine.country || wine.country_en || '';
      if (!image_url && wine.image_url) image_url = wine.image_url;
      supplierKr = wine.supplier_kr || '';
    }

    // CDV pricing
    const inv = cdvRes.data;
    if (inv) {
      if (inv.retail_price && !retail_price) retail_price = inv.retail_price;
      if (inv.min_price && !min_price) min_price = inv.min_price;
    }

    // tasting note
    const tn = tnRes.data;
    if (tn && !tasting_note) {
      const parts = [tn.color_note, tn.nose_note, tn.palate_note].filter(Boolean);
      if (parts.length > 0) tasting_note = parts.join(' / ');
    }

    // Phase 2: DL fallback (CDV 에 retail_price 없었을 때만)
    if (!retail_price) {
      const { data: dlInv } = await supabase
        .from('inventory_dl')
        .select('retail_price')
        .eq('item_no', item_code)
        .maybeSingle();
      if (dlInv?.retail_price) retail_price = dlInv.retail_price;
    }

    // Phase 2b: glass_specs 조회 — 글라스 품목이면 image_url + spec 자동 채움
    const { data: gs } = await supabase
      .from('glass_specs')
      .select('image_url, height_cm, capacity_ml, description, series')
      .eq('item_no', item_code)
      .maybeSingle();
    if (gs) {
      if (!image_url && gs.image_url) image_url = gs.image_url;
      const specParts: string[] = [];
      if (gs.height_cm != null) specParts.push(`H: ${gs.height_cm}cm`);
      if (gs.capacity_ml != null) specParts.push(`C: ${gs.capacity_ml}ml`);
      if (specParts.length) spec = specParts.join(' / ');
      if (!brand && gs.series) brand = gs.series;
    }

    vintage = extractVintage(item_code);

    // Phase 3a: 중복이면 합산 후 return
    const existing = dupRes.data;
    if (existing) {
      const newQty = (Number(existing.quantity) || 0) + (Number(quantity) || 1);
      const { data: updated } = await supabase
        .from('quote_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      return { success: true, item: updated, merged: true };
    }

    // sort_order (sortRes 에서 획득)
    const nextSort = ((sortRes.data?.sort_order) ?? 0) + 1;

    // 이름 정제
    korean_name = removePrefix(korean_name);
    product_name = removePrefix(product_name);
    if (supplierKr) {
      if (product_name && !product_name.startsWith(supplierKr)) {
        product_name = `${supplierKr}, ${product_name}`;
      }
      if (korean_name && !korean_name.startsWith(supplierKr)) {
        korean_name = `${supplierKr}, ${korean_name}`;
      }
    }
    if (!product_name && korean_name) product_name = korean_name;

    return insertQuoteRow({
      item_code, country, brand, region, image_url, spec, vintage,
      product_name, english_name, korean_name,
      supply_price, min_price, retail_price, discount_rate, quantity,
      note, tasting_note, manager, nextSort,
    });
  }

  // item_code 없을 때: enrichment skip, 단순 sort_order 만 조회 후 insert
  const { data: maxRow } = await sortQueryFn();
  const nextSort = ((maxRow?.sort_order) ?? 0) + 1;

  korean_name = removePrefix(korean_name);
  product_name = removePrefix(product_name);
  if (!product_name && korean_name) product_name = korean_name;

  return insertQuoteRow({
    item_code, country, brand, region, image_url, spec, vintage,
    product_name, english_name, korean_name,
    supply_price, min_price, retail_price, discount_rate, quantity,
    note, tasting_note, manager, nextSort,
  });
}

type InsertPayload = {
  item_code: string; country: string; brand: string; region: string;
  image_url: string; spec: string; vintage: string;
  product_name: string; english_name: string; korean_name: string;
  supply_price: number | string; min_price: number | string;
  retail_price: number | string; discount_rate: number | string;
  quantity: number | string;
  note: string; tasting_note: string; manager: string; nextSort: number;
};

async function insertQuoteRow(p: InsertPayload) {
  const price = Number(p.supply_price) || 0;
  const mPrice = Number(p.min_price) || 0;
  const rPrice = Number(p.retail_price) || 0;
  const rate = Number(p.discount_rate) || 0;
  const qty = Number(p.quantity) || 1;
  const discounted_price = Math.round(price * (1 - rate));

  const { data: inserted, error } = await supabase
    .from('quote_items')
    .insert({
      item_code: p.item_code, country: p.country, brand: p.brand,
      region: p.region, image_url: p.image_url, spec: p.spec, vintage: p.vintage,
      product_name: p.product_name, english_name: p.english_name, korean_name: p.korean_name,
      supply_price: price, min_price: mPrice, retail_price: rPrice,
      discount_rate: rate, discounted_price,
      quantity: qty, note: p.note, tasting_note: p.tasting_note,
      sort_order: p.nextSort, manager: p.manager,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, item: inserted };
}
