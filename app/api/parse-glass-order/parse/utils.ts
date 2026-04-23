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

export function pickBrandToken(input: string) {
  const stop = new Set(["주식회사", "스시", "점", "지점", "본점"]);
  const toks = extractKoreanTokens(input)
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
  const b = norm(nRaw);
  if (!a || !b) return 0;

  // 괄호 안 별칭 우선
  const nameAlias = nRaw.match(/\(([^)]+)\)/);
  if (nameAlias) {
    const aliasText = nameAlias[1].trim();
    const aliasNorm = norm(aliasText);

    if (a === aliasNorm) return 1.0;
    if (aliasNorm.includes(a) || a.includes(aliasNorm)) return 0.98;

    const aChars = new Set(a.split(""));
    const aliasChars = new Set(aliasNorm.split(""));
    let common = 0;
    for (const ch of aChars) {
      if (aliasChars.has(ch)) common++;
    }
    const similarity = common / Math.max(a.length, aliasNorm.length);

    if (similarity >= 0.7) {
      const lenDiff = Math.abs(a.length - aliasNorm.length);
      const lenPenalty = lenDiff * 0.02;
      return Math.max(0.85, Math.min(0.97, 0.95 - lenPenalty));
    }
  }

  // 브랜드 토큰이 name에 없으면 감점
  const brand = pickBrandToken(qRaw);
  if (brand) {
    const brandNorm = norm(brand);
    const nameMainText = nRaw.replace(/\([^)]+\)/g, "").trim();
    const nameAliasText = nameAlias ? nameAlias[1].trim() : "";
    const nameMainNorm = norm(nameMainText);
    const nameAliasNorm = norm(nameAliasText);

    if (brandNorm && !b.includes(brandNorm) && !nameMainNorm.includes(brandNorm) && !nameAliasNorm.includes(brandNorm)) {
      return 0.45;
    }
  }

  // 지점/분점 보정
  const extractBranchTokens = (s: string) =>
    extractKoreanTokens(s)
      .map((t) => t.replace(/(지점|점|본점)$/g, ""))
      .filter(Boolean);

  const stop2 = new Set(["주식회사", brand]);
  const qTokens = extractBranchTokens(qRaw).filter((t) => !stop2.has(t));
  const nTokens = extractBranchTokens(nRaw).filter((t) => !stop2.has(t));

  let branchAdj = 0;
  if (qTokens.length > 0) {
    const hasAny = qTokens.some((t) => nTokens.includes(t));
    if (hasAny) branchAdj += 0.18;
    const hasMismatch = nTokens.some((t) => !qTokens.includes(t));
    if (!hasAny && hasMismatch) branchAdj -= 0.25;
  }

  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) {
    return Math.max(0, Math.min(0.99, 0.9 + branchAdj));
  }

  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  const overlap = common / Math.max(6, a.length);
  const base = Math.max(0, Math.min(0.89, overlap));

  return Math.max(0, Math.min(0.99, base + branchAdj));
}

export function isLikelyOrderLine(line: string) {
  return /(\d|병|박스|cs|box|bt|btl|잔|개)/i.test(line);
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
