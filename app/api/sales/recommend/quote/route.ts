import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { loadMasterSheet, getDownloadsRetailPriceMap, getDlRetailPriceMap } from '@/app/lib/masterSheet';

function extractVintage(itemCode: string): string {
  if (!itemCode || itemCode.length < 4) return '';
  const vPart = itemCode.substring(2, 4);
  const upper = vPart.toUpperCase();
  if (upper === 'NV' || upper === 'MV') return upper;
  if (!/^\d{2}$/.test(vPart)) return vPart;
  const num = parseInt(vPart);
  return num >= 50 ? `19${vPart}` : `20${vPart}`;
}

function removePrefix(name: string): string {
  if (!name) return '';
  return name.replace(/^[A-Za-z]{2}\s+/, '').trim();
}

export async function POST(req: Request) {
  try {
    const { items, client_code, client_name, clear_existing } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '추천 와인 목록이 필요합니다.' }, { status: 400 });
    }

    // 견적서 생성(download) 모드: 기존 quote_items 전체 삭제 후 새로 생성
    if (clear_existing) {
      await supabase.from('quote_items').delete().neq('id', 0);
    }

    // 마스터 시트 로드
    let masterItems: any[] = [];
    try { masterItems = loadMasterSheet(); } catch { /* ignore */ }

    const retailPriceMap = getDownloadsRetailPriceMap();
    const dlRetailMap = getDlRetailPriceMap();

    const addedItems: any[] = [];

    for (const item of items) {
      const itemCode = item.item_no || item.item_code || '';
      if (!itemCode) continue;

      // 마스터 시트에서 보강
      const master = masterItems.find(m => m.itemNo === itemCode);
      let brand = master?.producer || '';
      let english_name = master?.englishName || '';
      let korean_name = removePrefix(master?.koreanName || item.item_name || '');
      let region = master?.region || '';
      let country = master?.country || item.country || '';
      const vintage = extractVintage(itemCode);
      const product_name = korean_name;

      const supply_price = item.price || master?.supplyPrice || 0;
      let retail_price = retailPriceMap.get(itemCode) || dlRetailMap.get(itemCode) || 0;

      // 중복 체크: 이미 quote_items에 같은 item_code 있으면 수량 합산
      const { data: existing } = await supabase
        .from('quote_items')
        .select('id, quantity')
        .eq('item_code', itemCode)
        .maybeSingle();

      if (existing) {
        const newQty = existing.quantity + 1;
        await supabase
          .from('quote_items')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        addedItems.push({ item_code: itemCode, merged: true, quantity: newQty });
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('quote_items')
        .insert({
          item_code: itemCode,
          country,
          brand,
          region,
          image_url: '',
          vintage,
          product_name,
          english_name,
          korean_name,
          supply_price: Number(supply_price) || 0,
          retail_price: Number(retail_price) || 0,
          discount_rate: 0,
          discounted_price: Number(supply_price) || 0,
          quantity: 1,
          note: '',
          tasting_note: '',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Quote insert error:', insertError);
        continue;
      }
      addedItems.push(inserted);
    }

    // recommendations 테이블에 이력 저장
    if (client_code) {
      const itemCodes = items.map((i: any) => i.item_no || i.item_code).filter(Boolean);
      await supabase.from('recommendations').insert({
        client_code,
        item_codes: itemCodes,
        reason: `견적서 생성 (${itemCodes.length}개 와인)`,
        recommendation_type: 'mixed',
        status: 'sent',
      });
    }

    return NextResponse.json({
      success: true,
      added_count: addedItems.length,
      items: addedItems,
      export_url: '/api/quote/export',
    });

  } catch (error) {
    console.error('Recommend quote error:', error);
    return NextResponse.json(
      { error: '견적서 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
