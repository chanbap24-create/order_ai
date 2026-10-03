// 단골 카드 데이터 모양 — 목업과 실제 API가 같은 타입을 쓴다.
import type { QuizAnswers } from '@/app/sommelier/lib/quiz';

export type CustomerCardData = {
  id: number;
  name: string;
  phoneMasked: string;           // 010-****-5678
  marketing: boolean;            // 광고성 수신 동의
  firstVisit: string;            // YYYY-MM-DD
  lastVisit: string;
  registeredBy: string;          // 처음 등록한 직원
  stats: { visits: number; purchases: number; bottles: number; amount: number; avgUnit: number };
  taste: {
    type: string; countries: string; grapes: string;          // 많이 산 것
    body: number | null; sweetness: number | null; acidity: number | null; tannin: number | null; // 1~5 평균
    flavors: string[];                                       // 자주 산 향
    quiz: { type: string; body: string; price: string };     // 문답에서 자주 고른 것
  };
  purchases: Array<{ date: string; name: string; vintage: string | null; qty: number; amount: number; source: 'quiz' | 'stock' }>;
  sessions: Array<{ date: string; answers: string; bought: number }>;
  memo: string;                  // 직원 메모
  memoMeta: string;              // '조성재 · 10.03 수정' (없으면 '')
  suggested: QuizAnswers;        // '이 취향으로 추천' — 구매 취향으로 채운 문답 답변
};
