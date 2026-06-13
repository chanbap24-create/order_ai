import type { Client } from "../types";

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const tokens = (s: string) =>
  s.toLowerCase().split(/[\s()/\-_·,]+/).map((t) => t.trim()).filter((t) => t.length >= 2);

/**
 * 거래처 힌트 → 후보 목록에서 자동 선택할 단일 매칭.
 * 후보가 여러 개여도 "가장 잘 맞는 하나"를 점수로 골라 자동 선택한다.
 * 점수: 이름 포함관계(+3) + 공통 토큰 수. 동점이면 힌트와 길이가 가까운 쪽.
 * 겹치는 게 전혀 없을 때만 null(→ 사용자 직접 선택).
 */
export function pickClientMatch(hint: string, list: Client[]): Client | null {
  const nh = norm(hint);
  if (!nh || list.length === 0) return null;

  // 1) 정확 일치(공백 무시) 우선
  const exact = list.find((c) => norm(c.client_name) === nh);
  if (exact) return exact;

  // 2) 점수 기반 최선 후보
  const hTokens = tokens(hint);
  let best: Client | null = null;
  let bestScore = 0;
  let bestLenDiff = Infinity;

  for (const c of list) {
    const nn = norm(c.client_name);
    let score = 0;
    if (nn.includes(nh) || nh.includes(nn)) score += 3;
    const cTokens = tokens(c.client_name);
    score += hTokens.filter((t) => cTokens.includes(t)).length;
    if (score === 0) continue;

    const lenDiff = Math.abs(nn.length - nh.length);
    if (score > bestScore || (score === bestScore && lenDiff < bestLenDiff)) {
      best = c;
      bestScore = score;
      bestLenDiff = lenDiff;
    }
  }

  return best; // 겹침 없으면 null
}

const AUTO_SIM = 0.6; // 퍼지 자동 선택 최소 유사도
const SIM_GAP = 0.08; // 2순위와 최소 격차(애매하면 자동선택 안 함)

/**
 * pickClientMatch(정확/부분) 실패 시 트라이그램 유사도(sim)로 폴백.
 * 오타·띄어쓰기로 정확 매칭이 안 되어도, 충분히 확실하면 자동 선택.
 * 애매(2순위와 근소)하면 null → 사용자가 후보에서 직접 선택.
 */
export function pickClientWithFuzzy(hint: string, list: Client[]): Client | null {
  const exact = pickClientMatch(hint, list);
  if (exact) return exact;
  const fz = list
    .filter((c) => typeof c.sim === "number")
    .sort((a, b) => (b.sim as number) - (a.sim as number));
  if (fz[0] && (fz[0].sim as number) >= AUTO_SIM && (!fz[1] || (fz[0].sim as number) - (fz[1].sim as number) >= SIM_GAP)) {
    return fz[0];
  }
  return null;
}
