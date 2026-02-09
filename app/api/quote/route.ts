import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import { loadMasterSheet } from '@/app/lib/masterSheet';

export const runtime = 'nodejs';

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
    const items = db.prepare('SELECT * FROM quote_items ORDER BY id ASC').all();
    return NextResponse.json({ success: true, items });
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
      const existing = db.prepare(
        'SELECT id, quantity FROM quote_items WHERE item_code = ?'
      ).get(item_code) as { id: number; quantity: number } | undefined;

      if (existing) {
        const newQty = existing.quantity + qty;
        db.prepare(
          "UPDATE quote_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(newQty, existing.id);

        const updated = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(existing.id);
        return NextResponse.json({ success: true, item: updated, merged: true });
      }
    }

    const result = db.prepare(`
      INSERT INTO quote_items (
        item_code, country, brand, region, image_url, vintage,
        product_name, english_name, korean_name,
        supply_price, retail_price, discount_rate, discounted_price,
        quantity, note, tasting_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item_code, country, brand, region, image_url, vintage,
      product_name, english_name, korean_name,
      price, rPrice, rate, discounted_price,
      qty, note, tasting_note
    );

    const item = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ success: true, item });

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

    const existing = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const allowedFields = [
      'item_code', 'country', 'brand', 'region', 'image_url', 'vintage',
      'product_name', 'english_name', 'korean_name',
      'supply_price', 'retail_price', 'discount_rate', 'quantity', 'note', 'tasting_note'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in fields) {
        updates.push(`${field} = ?`);
        values.push(fields[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '수정할 필드가 없습니다.' }, { status: 400 });
    }

    // discounted_price 재계산
    const newPrice = 'supply_price' in fields ? Number(fields.supply_price) : existing.supply_price;
    const newRate = 'discount_rate' in fields ? Number(fields.discount_rate) : existing.discount_rate;
    const discounted = Math.round(newPrice * (1 - newRate));
    updates.push('discounted_price = ?');
    values.push(discounted);

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE quote_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(id);
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

    const result = db.prepare('DELETE FROM quote_items WHERE id = ?').run(id);

    if (result.changes === 0) {
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
