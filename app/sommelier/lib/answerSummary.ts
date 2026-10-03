// 문답 답변 JSON → 사람이 읽는 한 줄 요약 — 관리자 소믈리에 탭·단골 카드 공용(클라이언트·서버 안전)
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';
import { BODY_OPTIONS, COUNTRY_OPTIONS, FLAVOR_GROUPS, PRICE_OPTIONS, TYPE_OPTIONS, type QuizAnswers } from './quiz';

export function answerSummary(a: Partial<QuizAnswers> & { via?: string }): string {
  const parts: string[] = [];
  if (a.via === 'auto') parts.push('지난 취향 추천'); // 문답 없이 구매 취향으로 바로 추천한 기록
  const t = TYPE_OPTIONS.find((o) => o.value === a.type); if (t?.value) parts.push(t.label);
  const b = BODY_OPTIONS.find((o) => o.value === a.body); if (b?.value) parts.push(b.label);
  for (const g of a.flavorGroups || []) parts.push(`${FLAVOR_GROUPS[g]?.label || g}(전체)`);
  for (const f of a.flavors || []) parts.push(FLAVOR_KO[f] || f);
  for (const c of a.countries || []) parts.push(COUNTRY_OPTIONS[c]?.label || c);
  const p = PRICE_OPTIONS.find((o) => o.min === (a.priceMin ?? null) && o.max === (a.priceMax ?? null));
  if (p && (p.min != null || p.max != null)) parts.push(p.label);
  else if (a.priceMin != null || a.priceMax != null) parts.push(`${Math.round((a.priceMin || 0) / 10000)}~${a.priceMax ? Math.round(a.priceMax / 10000) : ''}만원`);
  return parts.join(' · ') || '전부 상관없음';
}
