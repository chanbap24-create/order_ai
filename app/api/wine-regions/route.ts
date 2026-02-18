import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { sanitizeFilterValue } from '@/app/lib/validation';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const country = searchParams.get('country') || '';

  let query = supabase
    .from('wine_regions')
    .select('*')
    .order('country')
    .order('major_region')
    .order('sub_region')
    .order('appellation');

  if (country) {
    query = query.eq('country', country);
  }

  if (search) {
    const safe = sanitizeFilterValue(search);
    query = query.or(
      `country.ilike.%${safe}%,major_region.ilike.%${safe}%,sub_region.ilike.%${safe}%,appellation.ilike.%${safe}%,cru_vineyard.ilike.%${safe}%,classification.ilike.%${safe}%,grape_varieties.ilike.%${safe}%,notes.ilike.%${safe}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { country, major_region, sub_region, appellation, cru_vineyard, classification, grape_varieties, notes } = body;

  const { data, error } = await supabase
    .from('wine_regions')
    .insert({ country, major_region, sub_region, appellation, cru_vineyard, classification, grape_varieties, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('wine_regions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('wine_regions')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
