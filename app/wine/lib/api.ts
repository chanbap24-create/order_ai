import type { ParseResult } from "../types";

/** Wine 발주 파싱 API 페이로드 */
export type ParseWineOrderPayload = {
  message: string;
  force_resolve?: boolean;
  resolvedClientCode?: string;
  resolvedClientName?: string;
  customDeliveryDate?: string;
  requirePaymentConfirm?: boolean;
  requireInvoice?: boolean;
  newBusiness?: {
    name: string;
    phone: string;
    email?: string;
  };
};

async function postJson<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    throw new Error("세션이 만료되었습니다. 페이지를 새로고침하여 다시 로그인해주세요.");
  }
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { success: false, error: "Invalid JSON response: " + text };
  }
  if (!res.ok) {
    throw new Error(json?.error || `서버 오류 (${res.status})`);
  }
  return json;
}

/** 와인 발주 파싱 */
export async function parseWineOrder(payload: ParseWineOrderPayload): Promise<ParseResult> {
  return postJson("/api/parse-full-order", payload);
}

/** 거래처 품목 조회 (type: "wine") */
export async function fetchClientItems(clientCode: string): Promise<any[]> {
  const json = await postJson<{ success: boolean; items?: any[] }>("/api/client-items", {
    client_code: clientCode,
    type: "wine",
  });
  return json.success ? (json.items ?? []) : [];
}

/** 거래처 alias 학습 (type: "wine") — 실패 시 throw */
export async function learnClientAlias(params: {
  client_code: string;
  alias: string;
}): Promise<void> {
  await postJson("/api/learn-client", {
    client_code: params.client_code,
    alias: params.alias,
    type: "wine",
  });
}

export type LearnItemAliasInput = {
  alias: string;
  canonical: string;
  client_code?: string;
};

export type LearnItemAliasResult = {
  ok: boolean;
  error?: string;
};

/** 기존 품목 별칭 학습 */
export async function learnItemAlias(
  input: LearnItemAliasInput,
): Promise<LearnItemAliasResult> {
  const body = {
    alias: input.alias,
    canonical: input.canonical,
    ...(input.client_code ? { client_code: input.client_code } : {}),
  };
  try {
    const res = await fetch("/api/learn-item-alias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    const failed =
      !res.ok ||
      json?.success === false ||
      (typeof json?.saved === "number" && json.saved < 1);
    if (failed) return { ok: false, error: json?.error };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

export type LearnNewItemInput = {
  clientCode: string;
  selectedItemNo: string;
  selectedName: string;
  supplyPrice: number;
};

/** 신규 품목 저장 (wine 전용) */
export async function learnNewItem(input: LearnNewItemInput): Promise<LearnItemAliasResult> {
  try {
    const res = await fetch("/api/learn-new-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      return { ok: false, error: json?.error };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}
