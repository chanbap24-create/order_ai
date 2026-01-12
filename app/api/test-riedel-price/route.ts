import { NextResponse } from 'next/server';
import { loadRiedelSheet } from '@/app/lib/riedelSheet';
import { searchRiedelSheet } from '@/app/lib/riedelMatcher';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Riedel 시트 로드
    const items = loadRiedelSheet();
    
    // 공급가가 있는 항목들 확인
    const itemsWithPrice = items.filter(item => item.price > 0);
    
    // 샘플 데이터 (처음 5개)
    const sampleItems = items.slice(0, 5).map(item => ({
      code: item.code,
      koreanName: item.koreanName,
      englishName: item.englishName,
      price: item.price,
    }));
    
    // 검색 테스트: "아마데오"
    const searchResults = searchRiedelSheet('아마데오', 3);
    
    return NextResponse.json({
      success: true,
      totalItems: items.length,
      itemsWithPrice: itemsWithPrice.length,
      sampleItems,
      searchResults: searchResults.map(r => ({
        code: r.code,
        koreanName: r.koreanName,
        englishName: r.englishName,
        price: r.price,
        score: r.score,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
