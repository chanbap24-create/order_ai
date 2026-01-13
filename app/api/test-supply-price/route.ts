import { NextResponse } from 'next/server';
import { loadMasterSheet } from '@/app/lib/masterSheet';
import { searchMasterSheet } from '@/app/lib/masterMatcher';

export const runtime = 'nodejs';

export async function GET() {
  const items = loadMasterSheet();
  const itemsWithPrice = items.filter(i => i.supplyPrice);
  
  // 1124001 품목 찾기
  const target = items.find(i => i.itemNo === '1124001');
  
  // 검색 테스트
  const searchResults = searchMasterSheet('엘카사 모스카토', 5);
  
  return NextResponse.json({
    totalItems: items.length,
    itemsWithPrice: itemsWithPrice.length,
    target1124001: target ? {
      itemNo: target.itemNo,
      koreanName: target.koreanName,
      englishName: target.englishName,
      supplyPrice: target.supplyPrice
    } : null,
    searchResults: searchResults.map(r => ({
      itemNo: r.itemNo,
      koreanName: r.koreanName,
      englishName: r.englishName,
      supplyPrice: r.supplyPrice,
      score: r.score
    })),
    sampleItems: itemsWithPrice.slice(0, 5).map(i => ({
      itemNo: i.itemNo,
      koreanName: i.koreanName,
      supplyPrice: i.supplyPrice
    }))
  });
}
