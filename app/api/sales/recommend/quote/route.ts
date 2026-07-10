import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { addQuoteItem } from '@/app/api/quote/lib/addItem';

// 추천 와인 목록 → quote_items 적재.
// 수동 견적 담기(addQuoteItem)와 "동일한" 보강(이미지/브랜드/산지/소매가/테이스팅노트/중복합산)을
// 그대로 재사용한다. (이전엔 masterSheet 만 사용해 image_url='' · 브랜드/산지 누락 버그가 있었음)
export async function POST(req: Request) {
  try {
    const { items, client_code, clear_existing, manager } = await req.json();
    const mgr = typeof manager === 'string' ? manager : '';

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '추천 와인 목록이 필요합니다.' }, { status: 400 });
    }

    // 견적서 생성(download) 모드: 기존 quote_items 삭제 후 새로 생성 (매니저 스코프)
    if (clear_existing) {
      let del = supabase.from('quote_items').delete();
      del = mgr ? del.eq('manager', mgr) : del.neq('id', 0);
      await del;
    }

    // 각 추천 와인을 수동 담기와 동일 로직으로 적재 (순차 — sort_order/중복합산 정확성)
    const addedItems: unknown[] = [];
    for (const item of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const it = item as any;
      const itemCode = it.item_no || it.item_code || '';
      if (!itemCode) continue;
      try {
        const r = await addQuoteItem({
          item_code: itemCode,
          quantity: Number(it.rec_quantity) > 0 ? Number(it.rec_quantity) : 1, // 권장 수량(최빈가 묶음) 자동 입력
          supply_price: it.price || 0,
          discount_rate: Number(it.rec_discount) || 0, // 권장 할인율 자동 입력
          note: typeof it.rec_note === 'string' ? it.rec_note : undefined, // 비고: 수량 사다리
          manager: mgr,
        });
        if (r?.item) addedItems.push(r.item);
      } catch (e) {
        console.error('[recommend/quote] addQuoteItem 실패:', itemCode, e instanceof Error ? e.message : e);
      }
    }

    // recommendations 테이블에 이력 저장
    if (client_code) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      { error: '견적서 생성 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
