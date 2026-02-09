import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';

export const runtime = 'nodejs';

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

    const {
      item_code = '',
      country = '',
      brand = '',
      region = '',
      image_url = '',
      vintage = '',
      product_name = '',
      supply_price = 0,
      retail_price = 0,
      discount_rate = 0,
      quantity = 1,
      note = '',
      tasting_note = '',
    } = body;

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
        product_name, supply_price, retail_price, discount_rate, discounted_price,
        quantity, note, tasting_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item_code, country, brand, region, image_url, vintage,
      product_name, price, rPrice, rate, discounted_price,
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
      'product_name', 'supply_price', 'retail_price', 'discount_rate', 'quantity', 'note', 'tasting_note'
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
