// 거래처 등급 → 추천점수 가중치 스케일링.
// 거래처축(scoreParams: 산지/취향/견적학습)과 베이스축(segPts: 업장/업태/지역)을
// 등급별 목표점(GRADE_PERS/GRADE_BASE)에 맞춰 비례 확대/축소한다.
// 등급 0이면 스케일 1.0 → 기존 동작과 동일(하위호환).
import { DEFAULT_SCORE_PARAMS, SEG_PTS, type ScoreParams, type SegPts } from './scoring';
import { GRADE_PERS, GRADE_BASE, PERS_BASE_TOTAL, BASE_BASE_TOTAL } from '@/app/lib/pricing/clientGrade';

export function scaleForGrade(
  grade: number,
  sp: ScoreParams = DEFAULT_SCORE_PARAMS,
  segPts: SegPts = SEG_PTS,
): { scoreParams: ScoreParams; segPts: SegPts } {
  const g = Math.max(0, Math.min(4, Math.trunc(grade)));
  const persScale = GRADE_PERS[g] / PERS_BASE_TOTAL;
  const baseScale = GRADE_BASE[g] / BASE_BASE_TOTAL;

  const scoreParams: ScoreParams = {
    ...sp,
    tierBase: [
      sp.tierBase[0] * persScale,
      sp.tierBase[1] * persScale,
      sp.tierBase[2] * persScale,
      sp.tierBase[3] * persScale,
    ],
    softWeight: sp.softWeight * persScale,
    quoteFeedbackWeight: sp.quoteFeedbackWeight * persScale,
  };

  const scaled: SegPts = {
    venueType: segPts.venueType.map((x) => x * baseScale),
    venueCtry: segPts.venueCtry.map((x) => x * baseScale),
    btType: segPts.btType.map((x) => x * baseScale),
    btCtry: segPts.btCtry.map((x) => x * baseScale),
    regionType: segPts.regionType.map((x) => x * baseScale),
    regionCtry: segPts.regionCtry.map((x) => x * baseScale),
  };

  return { scoreParams, segPts: scaled };
}
