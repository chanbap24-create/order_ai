import type { UploadCardState, UploadMode } from "../types";
import { parsePaymentsFile } from "./parsers/payments";
import { parseShipmentsFile } from "./parsers/shipments";
import { parseImportScheduleFile } from "./parsers/importSchedule";
import { parseInventoryFile } from "./parsers/inventory";
import { parseClientInfoFile } from "./parsers/clientInfo";

export type UpdateCardFn = (type: string, patch: Partial<UploadCardState>) => void;

type UploadContext = {
  type: string;
  file: File;
  modeOverride?: UploadMode;
  uploadMode: Record<string, UploadMode>;
  updateCard: UpdateCardFn;
  checkStatus: () => void;
};

/**
 * 수금내역 (payments / dl-payments) 업로드.
 * 교체 모드는 기존 DB 대비 3배 이상 축소되면 경고.
 */
export async function uploadPayments(ctx: UploadContext): Promise<Response> {
  const { type, file, modeOverride, uploadMode, updateCard } = ctx;
  updateCard(type, { status: "uploading", fileName: file.name, message: "파일 분석 중..." });

  const { payments, carryovers } = await parsePaymentsFile(file);

  if (payments.length === 0) {
    alert("⚠️ 수금 데이터가 0건입니다. 파일을 확인해주세요.");
    updateCard(type, { status: "error", fileName: file.name, message: "수금 데이터 0건 - 파일 확인 필요" });
    throw new Error("empty");
  }

  const mode = modeOverride || uploadMode[type] || "replace";

  if (mode === "replace") {
    const payTable = type === "dl-payments" ? "dl_payments" : "payments";
    try {
      const checkRes = await fetch(`/api/admin/upload-data/check-range?table=${payTable}`);
      const rangeData = await checkRes.json();
      if (rangeData.count && rangeData.count > payments.length * 3) {
        const ok = confirm(
          `⚠️ 교체 모드 경고!\n\n` +
            `현재 DB: ${rangeData.count}건 (${rangeData.minDate} ~ ${rangeData.maxDate})\n` +
            `업로드 파일: ${payments.length}건\n\n` +
            `기존 ${rangeData.count}건이 삭제되고 ${payments.length}건으로 교체됩니다.\n` +
            `계속하시겠습니까?`,
        );
        if (!ok) {
          updateCard(type, { status: "idle", fileName: "", message: "" });
          throw new Error("cancelled");
        }
      }
    } catch (e) {
      if ((e as Error).message === "cancelled") throw e;
    }
  }

  let payMinDate: string | undefined;
  if (mode === "append") {
    const dates = payments.map((p) => p.payment_date).filter(Boolean);
    if (dates.length > 0) payMinDate = dates.sort()[0];
  }

  updateCard(type, {
    status: "uploading",
    fileName: file.name,
    message: `${payments.length}건 수금 + ${carryovers.length}건 이월 업로드 중... (${mode === "append" ? "누적" : "교체"})`,
  });

  const payEndpoint = type === "dl-payments" ? "dl-payments" : "payments";
  const res = await fetch(`/api/admin/upload-data/${payEndpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payments, carryovers, mode, minDate: payMinDate }),
  });

  if (res.ok) ctx.checkStatus();
  return res;
}

/**
 * 출고현황 (client / dl-client) 업로드.
 * 1) clients + items 저장
 * 2) shipments 5000건씩 배치 저장
 */
export async function uploadShipments(ctx: UploadContext): Promise<Response> {
  const { type, file, modeOverride, uploadMode, updateCard } = ctx;
  updateCard(type, { status: "uploading", fileName: file.name, message: "파일 분석 중..." });

  const parsed = await parseShipmentsFile(file, type as "client" | "dl-client");

  if ("kind" in parsed) {
    if (parsed.kind === "inventory_file") {
      alert('⚠️ 이 파일은 재고현황 파일입니다!\n\n"와인재고현황" 또는 "글라스재고현황" 영역에 업로드해주세요.');
      updateCard(type, { status: "error", fileName: file.name, message: "잘못된 파일 형식 - 재고현황 파일은 재고 영역에 업로드하세요." });
    } else {
      alert(`⚠️ 출고현황 파일이 아닌 것 같습니다.\n\n헤더에 "판매처", "출고일" 등이 없습니다.\n감지된 헤더: ${parsed.detected.join(", ")}`);
      updateCard(type, { status: "error", fileName: file.name, message: "잘못된 파일 형식 - 출고현황 헤더가 없습니다." });
    }
    throw new Error("invalid_file");
  }

  const { clients, items, shipments, header, indices } = parsed;

  // ship_date null 검증
  const nullDates = shipments.filter((s) => !s.ship_date).length;
  const sample = shipments[0];
  if (nullDates > shipments.length * 0.5 || !sample?.ship_date) {
    alert(
      `⚠️ 컬럼 매핑 오류 감지!\n\n` +
        `헤더 매핑: 판매처=[${indices.IDX_CLIENT_NAME}], 판매처번호=[${indices.IDX_CLIENT_CODE}], 출고일=[${indices.IDX_SHIP_DATE}], 품번=[${indices.IDX_ITEM_NO}], 품명=[${indices.IDX_ITEM_NAME}], 출고수량=[${indices.IDX_QUANTITY}], 담당자=[${indices.IDX_MANAGER}]\n\n` +
        `ship_date NULL: ${nullDates}/${shipments.length}행\n\n` +
        `엑셀 헤더: ${header.filter(Boolean).join(", ")}`,
    );
    updateCard(type, { status: "error", fileName: file.name, message: "컬럼 매핑 오류 - 엑셀 형식을 확인해주세요." });
    throw new Error("column_mapping");
  }

  const mode = modeOverride || uploadMode[type] || "replace";

  if (mode === "replace") {
    const shipTable = type === "client" ? "shipments" : "glass_shipments";
    try {
      const checkRes = await fetch(`/api/admin/upload-data/check-range?table=${shipTable}`);
      const rangeData = await checkRes.json();
      if (rangeData.count && rangeData.count > shipments.length * 3) {
        const ok = confirm(
          `⚠️ 교체 모드 경고!\n\n` +
            `현재 DB: ${rangeData.count.toLocaleString()}건\n` +
            `업로드 파일: ${shipments.length.toLocaleString()}건\n\n` +
            `기존 데이터가 삭제되고 교체됩니다. 계속하시겠습니까?`,
        );
        if (!ok) {
          updateCard(type, { status: "idle", fileName: "", message: "" });
          throw new Error("cancelled");
        }
      }
    } catch (e) {
      if ((e as Error).message === "cancelled") throw e;
    }
  }

  updateCard(type, {
    status: "uploading",
    fileName: file.name,
    message: `${Object.keys(clients).length}개 거래처, ${items.length}개 품목 업로드 중... (${mode === "append" ? "누적" : "교체"})`,
  });

  // 1) clients + items
  const res = await fetch(`/api/admin/upload-data/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clients, items, mode }),
  });
  if (!res.ok) return res;

  // 2) shipments 배치
  const BATCH = 5000;
  const shipType = type === "client" ? "client-shipments" : "dl-client-shipments";
  const totalBatches = Math.ceil(shipments.length / BATCH);

  let minDate: string | undefined;
  if (mode === "append") {
    const dates = shipments.map((s) => s.ship_date).filter(Boolean) as string[];
    if (dates.length > 0) minDate = dates.sort()[0];
  }

  for (let b = 0; b < totalBatches; b++) {
    const batch = shipments.slice(b * BATCH, (b + 1) * BATCH);
    updateCard(type, {
      status: "uploading",
      fileName: file.name,
      message: `출고 트랜잭션 업로드 중... (${b + 1}/${totalBatches})`,
    });
    const shipBody: Record<string, unknown> = {
      shipments: batch,
      clear: mode === "replace" && b === 0,
    };
    if (mode === "append" && b === 0 && minDate) shipBody.minDate = minDate;

    const shipRes = await fetch(`/api/admin/upload-data/${shipType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shipBody),
    });

    if (!shipRes.ok) {
      const j = await shipRes.json();
      console.error("Shipment batch error:", j);
      throw new Error(`출고 데이터 업로드 실패: ${j.error || "알 수 없는 오류"}`);
    }
  }

  ctx.checkStatus();
  return res;
}

/**
 * 거래처정보(ERP 명부) 업로드 — 세일즈 거래처 마스터(client_details/glass_clients) 갱신.
 * type: 'client-info'(와인) | 'dl-client-info'(글라스). N/P/X/Z 열 제외.
 */
export async function uploadClientInfo(ctx: UploadContext): Promise<Response> {
  const { type, file, updateCard } = ctx;
  updateCard(type, { status: "uploading", fileName: file.name, message: "거래처정보 분석 중..." });

  const rows = await parseClientInfoFile(file);
  if (rows.length === 0) {
    alert("⚠️ 거래처 데이터가 0건입니다. 거래처정보 파일이 맞는지 확인해주세요.");
    updateCard(type, { status: "error", fileName: file.name, message: "거래처 데이터 0건 - 파일 확인 필요" });
    throw new Error("empty");
  }

  updateCard(type, { status: "uploading", fileName: file.name, message: `${rows.length}개 거래처정보 업데이트 중...` });
  const res = await fetch(`/api/admin/upload-data/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (res.ok) ctx.checkStatus();
  return res;
}

/** 수입일정 업로드 */
export async function uploadImportSchedule(ctx: UploadContext): Promise<Response> {
  const { type, file, updateCard } = ctx;
  updateCard(type, { status: "uploading", fileName: file.name, message: "파일 분석 중..." });
  const items = await parseImportScheduleFile(file);
  updateCard(type, {
    status: "uploading",
    fileName: file.name,
    message: `${items.length}건 수입일정 업로드 중...`,
  });
  return fetch("/api/admin/upload-data/import-schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

/** 재고현황 (downloads/dl) 업로드 — 2000건 청크 */
export async function uploadInventory(ctx: UploadContext): Promise<Response> {
  const { type, file, updateCard } = ctx;
  updateCard(type, { status: "uploading", fileName: file.name, message: "재고 파일 분석 중..." });
  const rows = await parseInventoryFile(file);

  updateCard(type, {
    status: "uploading",
    fileName: file.name,
    message: `${rows.length}건 재고 업로드 중...`,
  });

  const CHUNK = 2000;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const chunkRes = await fetch(`/api/admin/upload-data/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: chunk, append: i > 0 }),
    });
    if (!chunkRes.ok) {
      const err = await chunkRes.json().catch(() => ({ error: "알 수 없는 오류" }));
      throw new Error(err.error || `재고 업로드 실패 (batch ${i})`);
    }
    total += chunk.length;
    updateCard(type, {
      status: "uploading",
      fileName: file.name,
      message: `${total}/${rows.length}건 업로드 중...`,
    });
  }

  // Downloads: 신규 와인 감지
  let extraInfo = {};
  if (type === "downloads") {
    try {
      updateCard(type, { status: "uploading", fileName: file.name, message: "신규 와인 감지 중..." });
      const detectRes = await fetch("/api/admin/upload/downloads-detect", { method: "POST" });
      if (detectRes.ok) extraInfo = await detectRes.json();
    } catch {
      /* non-fatal */
    }
  }

  return new Response(JSON.stringify({ success: true, type, items: total, ...extraInfo }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** 기본 FormData 업로드 (english/riedel 등) */
export async function uploadFormData(ctx: UploadContext): Promise<Response> {
  const formData = new FormData();
  formData.append("file", ctx.file);
  return fetch(`/api/admin/upload/${ctx.type}`, { method: "POST", body: formData });
}
