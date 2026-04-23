/**
 * Glass 페이지에서 사용하는 모든 서버 API 호출 래퍼.
 * 페이지/훅은 이 파일만 import 하고, fetch 세부는 여기에 가둔다.
 */

export type ParseGlassOrderPayload = {
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
  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.error || `서버 오류 (${res.status})`);
  }
  return res.json();
}

export async function parseGlassOrder(payload: ParseGlassOrderPayload): Promise<any> {
  return postJson("/api/parse-glass-order", payload);
}

export async function fetchClientItems(clientCode: string): Promise<any[]> {
  const json = await postJson<{ success: boolean; items?: any[] }>("/api/client-items", {
    client_code: clientCode,
    type: "glass",
  });
  return json.success ? (json.items ?? []) : [];
}

export async function learnClientAlias(params: {
  client_code: string;
  alias: string;
}): Promise<void> {
  await postJson("/api/learn-client", {
    client_code: params.client_code,
    alias: params.alias,
    type: "glass",
  });
}

export type LearnItemAliasInput = {
  alias: string;
  canonical: string;
  client_code?: string;
  dataType?: "glass" | "wine";
  price?: number;
};

export type LearnItemAliasResult = {
  ok: boolean;
  error?: string;
};

export async function learnItemAlias(
  input: LearnItemAliasInput,
): Promise<LearnItemAliasResult> {
  const body = {
    alias: input.alias,
    canonical: input.canonical,
    ...(input.client_code ? { client_code: input.client_code } : {}),
    ...(input.dataType ? { dataType: input.dataType } : {}),
    ...(typeof input.price === "number" ? { price: input.price } : {}),
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
