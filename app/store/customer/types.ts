// 단골 카드 데이터 모양 — 목업과 실제 API가 같은 타입을 쓴다.
import type { QuizAnswers } from '@/app/sommelier/lib/quiz';

export const AGE_BANDS = [['20s', '20대'], ['30s', '30대'], ['40s', '40대'], ['50s', '50대'], ['60s', '60대+']] as const;
export const GENDERS = [['F', '여성'], ['M', '남성']] as const;
export type AgeBand = (typeof AGE_BANDS)[number][0];
export type Gender = (typeof GENDERS)[number][0];

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
    type: string; countries: string; regions: string; grapes: string; // 많이 산 것(품종은 '이름 병수')
    body: number | null; sweetness: number | null; acidity: number | null; tannin: number | null; // 1~5 평균
    flavorGroups: Array<{ type: string; flavors: string[] }>; // 산 타입별 자주 산 향
    quiz: { type: string; body: string; price: string; flavors: string }; // 문답에서 자주 고른 것
  };
  purchases: Array<{ date: string; name: string; vintage: string | null; qty: number; amount: number; source: 'quiz' | 'stock' }>;
  sessionCount: number;          // 문답 전체 횟수
  sessions: Array<{ date: string; answers: string; bought: number }>; // 최근 3건
  // 연령대·성별 — 직원이 대략 기록(손님 화면엔 안 보임). 새 동의(버전 2) 손님만 기록 가능
  profile: { ageBand: AgeBand | null; gender: Gender | null; canEdit: boolean; meta: string };
  memo: string;                  // 직원 메모
  memoMeta: string;              // '조성재 · 10.03 수정' (없으면 '')
  suggested: QuizAnswers;        // '이 취향으로 추천' — 구매 취향으로 채운 문답 답변
};
