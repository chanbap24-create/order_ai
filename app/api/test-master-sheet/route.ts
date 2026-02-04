import { NextResponse } from 'next/server';
import { loadAllMasterItems, getDownloadsPriceMap } from '@/app/lib/masterSheet';

export async function GET() {
  try {
    console.log('[TEST] Loading master sheet...');
    
    const allItems = loadAllMasterItems();
    const priceMap = getDownloadsPriceMap();
    
    // 찰스 하이직 찾기
    const charles = allItems.filter(item => 
      item.itemNo === '00NV801' || 
      item.itemNo === '00NV805' || 
      item.itemNo === '00NV806'
    );
    
    return NextResponse.json({
      success: true,
      totalItems: allItems.length,
      priceMapSize: priceMap.size,
      charlesItems: charles.map(item => ({
        itemNo: item.itemNo,
        koreanName: item.koreanName,
        englishName: item.englishName,
        supplyPrice: item.supplyPrice,
      })),
      priceMapCheck: {
        '00NV801': priceMap.get('00NV801'),
        '00NV805': priceMap.get('00NV805'),
        '00NV806': priceMap.get('00NV806'),
      }
    });
  } catch (error: any) {
    console.error('[TEST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
