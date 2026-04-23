import { multiLevelTokenMatch } from "@/app/lib/multiLevelTokenMatcher";
import { normTight, norm } from "./normalize";
import { areTokenSynonyms } from "./tokenSynonyms";
import { decomposeCompoundKorean, scoreCompoundTokenMatch } from "./compoundToken";

/* ================= 점수 계산 ================= */

export function scoreItem(q: string, name: string, options?: { producer?: string }) {
  // 생산자 필터링 (생산자가 명시된 경우)
  if (options?.producer) {
    const producerNorm = normTight(options.producer);
    const nameNorm = normTight(name);

    if (!nameNorm.includes(producerNorm)) {
      console.log(`[Wine] ❌ 생산자 불일치: "${options.producer}" not in "${name}"`);
      return 0;
    }
    console.log(`[Wine] ✅ 생산자 일치: "${options.producer}" in "${name}"`);
  }

  // 🎯 모든 매칭 점수를 계산 후 최댓값 반환
  let bestScore = 0;

  // 1️⃣ 다단계 토큰 매칭 (2026-01-30 추가) — 루이미셸, 샤블리 등
  const multiLevelScore = multiLevelTokenMatch(q, name);
  bestScore = Math.max(bestScore, multiLevelScore);

  // 2️⃣ 영문 단어 매칭 우선
  const qEnglishWords = (q.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());
  const nameEnglishWords = (name.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());

  if (qEnglishWords.length >= 2 && nameEnglishWords.length >= 2) {
    const qSet = new Set(qEnglishWords);
    const nameSet = new Set(nameEnglishWords);
    const intersection = Array.from(qSet).filter(w => nameSet.has(w));

    if (intersection.length >= 3) {
      const recall = intersection.length / qSet.size;
      const precision = intersection.length / nameSet.size;
      const englishScore = Math.min(0.95, (recall + precision) / 2 + 0.2);
      bestScore = Math.max(bestScore, englishScore);
    } else if (intersection.length >= 2) {
      const recall = intersection.length / qSet.size;
      const englishScore = Math.min(0.85, recall + 0.3);
      bestScore = Math.max(bestScore, englishScore);
    }
  }

  // 3️⃣ 토큰 기반 매칭 (별칭 확장 대응 + 부분 매칭)
  const qTokens = q.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const nameTokens = name.toLowerCase().split(/\s+/).filter(t => t.length >= 2);

  if (qTokens.length >= 2 && nameTokens.length >= 1) {
    const nameSet = new Set(nameTokens);

    let matchedQTokens = 0;
    let matchedNameTokens = 0;

    for (const qt of qTokens) {
      let found = false;

      if (nameSet.has(qt)) {
        matchedQTokens++;
        matchedNameTokens++;
        found = true;
        continue;
      }

      // 와인 동의어 매칭 체크
      for (const nt of nameTokens) {
        if (areTokenSynonyms(qt, nt)) {
          matchedQTokens += 0.95;
          matchedNameTokens += 0.95;
          found = true;
          break;
        }
      }
      if (found) continue;

      // 부분 매칭 체크
      const qtNorm = normTight(qt);
      let combined = "";
      for (const nt of nameTokens) {
        combined += normTight(nt);
        if (combined === qtNorm) {
          matchedQTokens++;
          matchedNameTokens += combined.length / normTight(nt).length;
          found = true;
          break;
        }
        if (qtNorm.includes(combined) || combined.includes(qtNorm)) {
          matchedQTokens += 0.8;
          matchedNameTokens += 0.8;
          found = true;
          break;
        }
      }

      if (!found) {
        for (const nt of nameTokens) {
          const ntNorm = normTight(nt);
          if (qtNorm.includes(ntNorm) && ntNorm.length >= 3) {
            matchedQTokens += 0.5;
            matchedNameTokens += 0.5;
            break;
          }
        }
      }
    }

    if (matchedQTokens > 0) {
      const recall = matchedQTokens / qTokens.length;
      const precision = matchedNameTokens / nameTokens.length;

      let tokenScore = 0;
      if (recall >= 0.8) tokenScore = Math.min(0.95, 0.80 + (recall * 0.15) + (precision * 0.05));
      else if (recall >= 0.6) tokenScore = Math.min(0.85, 0.65 + (recall * 0.20));
      else if (recall >= 0.5) tokenScore = Math.min(0.75, 0.55 + (recall * 0.20));

      bestScore = Math.max(bestScore, tokenScore);
    }
  }

  // 4️⃣ 기존 한글 정규화 로직
  const a = norm(q);
  const b = norm(name);
  if (a && b) {
    if (a === b) {
      bestScore = Math.max(bestScore, 1.0);
    } else if (b.includes(a) || a.includes(b)) {
      bestScore = Math.max(bestScore, 0.9);
    } else {
      const aset = new Set(a.split(""));
      let common = 0;
      for (const ch of Array.from(aset)) if (b.includes(ch)) common++;
      const rawCharScore = common / Math.max(6, a.length);
      const compoundTokens = decomposeCompoundKorean(a);
      const charCap = compoundTokens.length >= 2 ? 0.70 : 0.89;
      const charScore = Math.min(charCap, rawCharScore);
      bestScore = Math.max(bestScore, charScore);
    }
  }

  // 5️⃣ 복합 토큰 분해 매칭 (아이니샤르도네 → "아이니" + "샤르도네")
  if (a && b && !b.includes(a) && !a.includes(b)) {
    const compoundScore = scoreCompoundTokenMatch(a, b);
    bestScore = Math.max(bestScore, compoundScore);
  }

  return bestScore;
}
