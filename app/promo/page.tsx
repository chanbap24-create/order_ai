import { getPromoPageData } from '@/app/lib/promoPage';
import { PromoClient } from './PromoClient';

// 이달의 프로모션 상세페이지 (공개 마케팅 페이지).
// 프로모션 탭에서 등록/수정하면 이 페이지가 자동 갱신된다 — 디자인 작업 반복 없음.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'CAVE DE VIN — 이달의 프로모션',
  description: '까브드뱅 이달의 프로모션 와인',
};

export default async function PromoPage() {
  const data = await getPromoPageData();
  return <PromoClient data={data} />;
}
