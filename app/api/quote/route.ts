import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import { loadMasterSheet, getDownloadsRetailPriceMap } from '@/app/lib/masterSheet';

// ── 유틸: 품목코드에서 빈티지 추출 ──
// item_code[2:4]가 빈티지. 예: 0018801→18→2018, 2019416→19→2019, 00NV801→NV
function extractVintage(itemCode: string): string {
  if (!itemCode || itemCode.length < 4) return '';
  const vPart = itemCode.substring(2, 4);
  const upper = vPart.toUpperCase();

  // NV, MV 그대로
  if (upper === 'NV' || upper === 'MV') return upper;

  // 숫자가 아니면 그대로
  if (!/^\d{2}$/.test(vPart)) return vPart;

  // 현재년도 2026 기준: >26이면 19XX, ≤26이면 20XX
  const num = parseInt(vPart);
  return num > 26 ? `19${vPart}` : `20${vPart}`;
}

// ── 유틸: 영어 2글자 약어 제거 ──
function removePrefix(name: string): string {
  if (!name) return '';
  // "DA 마지 샹베르탱" → "마지 샹베르탱"
  return name.replace(/^[A-Za-z]{2}\s+/, '').trim();
}

export async function GET() {
  try {
    ensureQuoteTable();
    const { data: items, error } = await supabase
      .from('quote_items')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, items: items || [] });
  } catch (error) {
    console.error('Quote GET error:', error);
    return NextResponse.json(
      { error: '견적서 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    ensureQuoteTable();
    const body = await req.json();

    let {
      item_code = '',
      country = '',
      brand = '',
      region = '',
      image_url = '',
      vintage = '',
      product_name = '',
      english_name = '',
      korean_name = '',
      supply_price = 0,
      retail_price = 0,
      discount_rate = 0,
      quantity = 1,
      note = '',
      tasting_note = '',
    } = body;

    // ── English 시트에서 데이터 보강 ──
    if (item_code) {
      try {
        const masterItems = loadMasterSheet();
        const masterItem = masterItems.find(m => m.itemNo === item_code);
        if (masterItem) {
          brand = masterItem.producer || brand;
          english_name = masterItem.englishName || english_name;
          korean_name = masterItem.koreanName || korean_name;
          region = masterItem.region || region;
          country = masterItem.country || country;
        }
      } catch (e) {
        console.error('Master sheet lookup error:', e);
      }

      // 소비자가(판매가): Downloads S열에서 조회
      if (!retail_price) {
        const retailPriceMap = getDownloadsRetailPriceMap();
        retail_price = retailPriceMap.get(item_code) || 0;
      }

      // 빈티지: 품목코드 3-4번째 자리에서 추출
      vintage = extractVintage(item_code);
    }

    // 영어 2글자 약어 제거
    korean_name = removePrefix(korean_name);
    product_name = removePrefix(product_name);

    // product_name이 비어있으면 korean_name 사용
    if (!product_name && korean_name) {
      product_name = korean_name;
    }

    const price = Number(supply_price) || 0;
    const rPrice = Number(retail_price) || 0;
    const rate = Number(discount_rate) || 0;
    const qty = Number(quantity) || 1;
    const discounted_price = Math.round(price * (1 - rate));

    // 동일 item_code가 이미 있으면 수량 합산
    if (item_code) {
      const { data: existing } = await supabase
        .from('quote_items')
        .select('id, quantity')
        .eq('item_code', item_code)
        .maybeSingle();

      if (existing) {
        const newQty = existing.quantity + qty;
        await supabase
          .from('quote_items')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        const { data: updated } = await supabase
          .from('quote_items')
          .select('*')
          .eq('id', existing.id)
          .maybeSingle();

        return NextResponse.json({ success: true, item: updated, merged: true });
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('quote_items')
      .insert({
        item_code, country, brand, region, image_url, vintage,
        product_name, english_name, korean_name,
        supply_price: price, retail_price: rPrice, discount_rate: rate, discounted_price,
        quantity: qty, note, tasting_note
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, item: inserted });

  } catch (error) {
    console.error('Quote POST error:', error);
    return NextResponse.json(
      { error: '견적서 추가 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    ensureQuoteTable();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('quote_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const allowedFields = [
      'item_code', 'country', 'brand', 'region', 'image_url', 'vintage',
      'product_name', 'english_name', 'korean_name',
      'supply_price', 'retail_price', 'discount_rate', 'quantity', 'note', 'tasting_note'
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in fields) {
        updateData[field] = fields[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '수정할 필드가 없습니다.' }, { status: 400 });
    }

    // discounted_price 재계산
    const newPrice = 'supply_price' in fields ? Number(fields.supply_price) : existing.supply_price;
    const newRate = 'discount_rate' in fields ? Number(fields.discount_rate) : existing.discount_rate;
    const discounted = Math.round(newPrice * (1 - newRate));
    updateData.discounted_price = discounted;
    updateData.updated_at = new Date().toISOString();

    await supabase
      .from('quote_items')
      .update(updateData)
      .eq('id', id);

    const { data: updated } = await supabase
      .from('quote_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return NextResponse.json({ success: true, item: updated });

  } catch (error) {
    console.error('Quote PATCH error:', error);
    return NextResponse.json(
      { error: '견적서 수정 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureQuoteTable();

    // Support both query param and body
    let id: string | null = req.nextUrl.searchParams.get('id');
    if (!id) {
      try {
        const body = await req.json();
        id = body.id?.toString() || null;
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('quote_items')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Quote DELETE error:', error);
    return NextResponse.json(
      { error: '견적서 삭제 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
