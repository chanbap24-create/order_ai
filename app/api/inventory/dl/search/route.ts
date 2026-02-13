import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const filterCountry = searchParams.get('country') || '';
    const filterRegion = searchParams.get('region') || '';
    const filterWineType = searchParams.get('wine_type') || '';
    const filterGrapeVariety = searchParams.get('grape_variety') || '';

    if (!query.trim() && !filterCountry && !filterRegion && !filterWineType && !filterGrapeVariety) {
      return NextResponse.json({
        results: [],
        count: 0,
        query: '',
        message: '검색어를 입력해주세요.'
      });
    }

    // Query inventory_dl first
    let dbQuery = supabase
      .from('inventory_dl')
      .select('*');

    if (query.trim()) {
      const searchQuery = `%${query.toLowerCase()}%`;
      dbQuery = dbQuery.or(`item_name.ilike.${searchQuery},item_no.ilike.${searchQuery}`);
    }

    if (filterCountry) {
      dbQuery = dbQuery.eq('country', filterCountry);
    }

    dbQuery = dbQuery.order('supply_price', { ascending: false });

    const { data, error } = await dbQuery;
    if (error) throw error;

    // Fetch wine_profiles separately for matched item_nos
    const itemNos = (data || []).map((r: any) => r.item_no);
    let wpMap: Record<string, any> = {};
    if (itemNos.length > 0) {
      const { data: wpData } = await supabase
        .from('wine_profiles')
        .select('item_code, grape_varieties, wine_type, region, description_kr, country')
        .in('item_code', itemNos);
      if (wpData) {
        for (const wp of wpData) {
          wpMap[wp.item_code] = wp;
        }
      }
    }

    let results = (data || []).map((row: any) => {
      const wp = wpMap[row.item_no];
      return {
        ...row,
        grape_varieties: wp?.grape_varieties || null,
        wine_type: wp?.wine_type || null,
        wp_region: wp?.region || null,
        description_kr: wp?.description_kr || null,
      };
    });

    // Apply wine_profile filters in JS
    if (filterRegion) {
      results = results.filter((r: any) => r.wp_region === filterRegion);
    }
    if (filterWineType) {
      results = results.filter((r: any) => r.wine_type === filterWineType);
    }
    if (filterGrapeVariety) {
      results = results.filter((r: any) =>
        r.grape_varieties && r.grape_varieties.toLowerCase().includes(filterGrapeVariety.toLowerCase())
      );
    }

    return NextResponse.json({
      results,
      count: results.length,
      query
    });

  } catch (error: any) {
    console.error('DL 재고 검색 오류:', error);
    return NextResponse.json(
      { error: error.message || '검색 중 오류가 발생했습니다.', details: error.stack },
      { status: 500 }
    );
  }
}
