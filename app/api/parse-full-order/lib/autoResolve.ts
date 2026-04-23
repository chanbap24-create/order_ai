import { logger } from "@/app/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Config = any;

/**
 * suggestions와 기존 resolved 상태를 보고 최종 resolved 재판단.
 *  - resolved=true인데 item_no 없으면 false
 *  - 신규 품목(is_new_item=true)은 자동 확정 안 함
 *  - topScore >= 0.9 고득점은 무조건 확정
 *  - 2위가 신규면 gap 무시
 *  - 아니면 gap 체크
 */
export function redetermineResolved(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  x: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suggestions: any[],
  config: Config,
): { resolved: boolean; itemOverride: boolean } {
  let resolved = x?.resolved ?? false;

  if (resolved && !x?.item_no) {
    logger.debug(`[AutoResolve] resolved=true인데 item_no 없음 → resolved=false`, { name: x.name });
    resolved = false;
  }

  if (resolved) return { resolved: true, itemOverride: false };
  if (suggestions.length === 0) return { resolved: false, itemOverride: false };

  const top = suggestions[0];
  const second = suggestions[1];
  const gap = second ? (top.score ?? 0) - (second.score ?? 0) : 999;

  const isNewItem = top.is_new_item ?? false;

  if (isNewItem) {
    logger.debug(`[AutoResolve] 신규품목 수동 확인 필요`, { name: x.name, score: top.score });
    return { resolved: false, itemOverride: false };
  }

  const minScore = config.autoResolve?.minScore ?? 0.55;
  const minGap = config.autoResolve?.minGap ?? 0.10;
  const topScore = top.score ?? 0;

  // 0.9점 이상: 무조건 확정
  if (topScore >= 0.90) {
    logger.debug(`[AutoResolve] 고득점 확정`, { name: x.name, score: topScore });
    return { resolved: true, itemOverride: true };
  }

  // 2위가 신규 품목이면 gap 무시
  if (second && (second.is_new_item ?? false)) {
    const res = topScore >= minScore;
    logger.debug(`[AutoResolve] 2위 신규품목 → gap 무시`, { name: x.name, score: topScore, resolved: res });
    return { resolved: res, itemOverride: res };
  }

  // 기존 로직: gap 체크
  const res = top.item_no && topScore >= minScore && gap >= minGap;
  logger.debug(`[AutoResolve] 기존품목 gap 체크`, { name: x.name, score: topScore, gap, resolved: res });
  return { resolved: res, itemOverride: res };
}
