// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cleanClientCode(code: any) {
  return String(code || "").replace(/\.0$/, "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function norm(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "")
    .replace(/(주식회사|\(주\)|주\.)/g, "");
}

export function extractKoreanTokens(s: string) {
  return (String(s || "").match(/[가-힣A-Za-z0-9]{2,}/g) || [])
    .map((t) => t.trim())
    .filter(Boolean);
}

// 입력에서 브랜드(핵심) 토큰 1개를 뽑음: 가장 긴 토큰 우선
export function pickBrandToken(input: string) {
  const stop = new Set(["주식회사", "스시", "점", "지점", "본점"]);

  const aliasMatch = input.match(/\(([^)]+)\)/);
  const mainText = input.replace(/\([^)]+\)/g, "").trim();
  const aliasText = aliasMatch ? aliasMatch[1].trim() : "";

  const allText = [mainText, aliasText].filter(Boolean).join(" ");

  const toks = extractKoreanTokens(allText)
    .map((t) => t.replace(/(지점|점|본점)$/g, ""))
    .filter((t) => t.length >= 2 && !stop.has(t));

  toks.sort((a, b) => b.length - a.length);
  return toks[0] || "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function firstLine(text: any) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[0] || "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scoreName(q: any, name: any) {
  const qRaw = String(q ?? "");
  const nRaw = String(name ?? "");

  const a = norm(qRaw);
  if (!a) return 0;

  // (0) 괄호 안 상호명 우선 매칭
  const nameAlias = nRaw.match(/\(([^)]+)\)/);
  const nameMainText = nRaw.replace(/\([^)]+\)/g, "").trim();

  if (nameAlias) {
    const aliasText = nameAlias[1].trim();
    const aliasNorm = norm(aliasText);
    const mainNorm = norm(nameMainText);

    if (a === aliasNorm) return 1.0;
    if (a === mainNorm) return 1.0;

    if (aliasNorm.includes(a)) return 0.98;
    if (a.includes(aliasNorm) && aliasNorm.length >= 3) return 0.97;

    if (mainNorm.includes(a)) return 0.96;
    if (a.includes(mainNorm) && mainNorm.length >= 3) return 0.95;

    const aChars = new Set(a.split(""));
    const aliasChars = new Set(aliasNorm.split(""));
    let commonAlias = 0;
    for (const ch of aChars) {
      if (aliasChars.has(ch)) commonAlias++;
    }
    const aliasSimilarity = commonAlias / Math.max(a.length, aliasNorm.length);

    if (aliasSimilarity >= 0.7) {
      const lenDiff = Math.abs(a.length - aliasNorm.length);
      const lenPenalty = lenDiff * 0.02;
      return Math.max(0.85, Math.min(0.94, 0.92 - lenPenalty));
    }

    const mainChars = new Set(mainNorm.split(""));
    let commonMain = 0;
    for (const ch of aChars) {
      if (mainChars.has(ch)) commonMain++;
    }
    const mainSimilarity = commonMain / Math.max(a.length, mainNorm.length);

    if (mainSimilarity >= 0.7) {
      const lenDiff = Math.abs(a.length - mainNorm.length);
      const lenPenalty = lenDiff * 0.02;
      return Math.max(0.80, Math.min(0.90, 0.88 - lenPenalty));
    }
  }

  // 괄호 없는 경우
  const b = norm(nRaw);
  if (!b) return 0;

  if (a === b) return 1.0;
  if (b.includes(a)) return 0.90;
  if (a.includes(b) && b.length >= 3) return 0.88;

  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  const overlap = common / Math.max(a.length, b.length);

  if (overlap >= 0.7) {
    const lenDiff = Math.abs(a.length - b.length);
    const lenPenalty = lenDiff * 0.02;
    return Math.max(0.60, Math.min(0.85, 0.82 - lenPenalty));
  }

  return Math.max(0, Math.min(0.75, overlap * 0.9));
}

export function isLikelyOrderLine(line: string) {
  return /(\d|병|박스|cs|box|bt|btl)/i.test(line);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function splitClientAndOrder(body: any) {
  const message = body?.message ?? "";
  const clientText = body?.clientText ?? "";
  const orderText = body?.orderText ?? "";

  if (clientText || orderText) {
    return {
      rawMessage: String(message || ""),
      clientText: String(clientText || ""),
      orderText: String(orderText || ""),
    };
  }

  const msg = String(message || "").replace(/\r/g, "");
  const lines = msg.split("\n");
  const first = (lines[0] || "").trim();
  const rest = lines.slice(1).join("\n").trim();

  if (lines.length <= 1) {
    return { rawMessage: msg, clientText: "", orderText: msg };
  }

  if (isLikelyOrderLine(first)) {
    return { rawMessage: msg, clientText: "", orderText: msg };
  }

  return { rawMessage: msg, clientText: first, orderText: rest };
}
