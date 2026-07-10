// app/lib/pricing/venueCategory.ts
// 업장 유형 태그(client_venue.venue, venueTypes.ts의 key) → 가격공식 업태 카테고리 매핑.
//   · wholesale(도매장)  → 'wholesale'
//   · retail(샵·편의점·백화점) → 'shop'
//   · 그 외 전부(호텔 + 모든 요리 업태) → 'venue'(업소/호텔)
//   · 태그 없음/미상 → 'venue' 기본(가장 흔한 업소)
import type { VenueCategory } from './discountRate';

export function venueKeyToCategory(venueKey: string | null | undefined): VenueCategory {
  if (venueKey === 'wholesale') return 'wholesale';
  if (venueKey === 'retail') return 'shop';
  return 'venue';
}
