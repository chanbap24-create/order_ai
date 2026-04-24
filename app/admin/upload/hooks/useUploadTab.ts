import { useCallback, useEffect, useState } from "react";
import type { UploadCardState, UploadMode } from "../types";
import { UPLOAD_AREAS } from "../constants";
import {
  uploadFormData,
  uploadImportSchedule,
  uploadInventory,
  uploadPayments,
  uploadShipments,
  type UpdateCardFn,
} from "../lib/uploadHandlers";
import { broadcastDataInvalidation, clearCacheByPrefix } from "@/app/lib/sessionCache";

// 업로드 type 과 브로드캐스트 key 매핑
const INVALIDATION_KEY_MAP: Record<string, string> = {
  "import-schedule": "import_schedule",
  client: "shipments",
  "dl-client": "shipments",
  payments: "payments",
  "dl-payments": "payments",
  downloads: "inventory",
  dl: "inventory",
};

type Props = {
  onUploadComplete?: (type: string, result: Record<string, unknown>) => void;
};

/**
 * UploadTab 전체 state + handleUpload + checkStatus 통합.
 */
export function useUploadTab({ onUploadComplete }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusError, setStatusError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [cards, setCards] = useState<Record<string, UploadCardState>>(
    Object.fromEntries(
      UPLOAD_AREAS.map((a) => [
        a.type,
        { status: "idle" as const, fileName: "", message: "", isDragOver: false },
      ]),
    ),
  );
  const [uploadMode, setUploadMode] = useState<Record<string, UploadMode>>({
    client: "append",
    "dl-client": "append",
    payments: "append",
    "dl-payments": "append",
  });
  const [shipmentLastDates, setShipmentLastDates] = useState<Record<string, string | null>>({
    client: null,
    "dl-client": null,
  });
  const [paymentLastDates, setPaymentLastDates] = useState<Record<string, string | null>>({
    payments: null,
    "dl-payments": null,
  });
  const [inventoryLastDates, setInventoryLastDates] = useState<Record<string, string | null>>({
    downloads: null,
    dl: null,
  });

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setStatusError("");
    try {
      const response = await fetch("/api/sync-inventory");
      const data = await response.json();
      setStatusResult(data);
      if (data.shipmentLastDates) setShipmentLastDates(data.shipmentLastDates);
      if (data.paymentLastDates) setPaymentLastDates(data.paymentLastDates);
      if (data.inventoryLastDates) setInventoryLastDates(data.inventoryLastDates);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "상태 확인 실패");
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const updateCard: UpdateCardFn = useCallback((type, patch) => {
    setCards((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }, []);

  const handleUpload = useCallback(
    async (type: string, file: File, modeOverride?: UploadMode) => {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) return;

      updateCard(type, { status: "uploading", fileName: file.name, message: "" });

      const ctx = { type, file, modeOverride, uploadMode, updateCard, checkStatus };

      try {
        let res: Response;
        if (type === "payments" || type === "dl-payments") res = await uploadPayments(ctx);
        else if (type === "client" || type === "dl-client") res = await uploadShipments(ctx);
        else if (type === "import-schedule") res = await uploadImportSchedule(ctx);
        else if (type === "downloads" || type === "dl") res = await uploadInventory(ctx);
        else res = await uploadFormData(ctx);

        const json = await res.json();

        if (!res.ok || !json.success) {
          const errMsg = json.error || `업로드 실패 (${res.status})`;
          updateCard(type, { status: "error", message: errMsg });
          throw new Error(errMsg);
        }

        const details = Object.entries(json)
          .filter(([k]) => !["success", "type", "label", "fileName", "fileSize"].includes(k))
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");

        updateCard(type, { status: "success", message: details || "업로드 완료" });

        // 1) 같은 탭의 sessionStorage 캐시 즉시 정리
        // 2) 다른 탭(재고/영업 미팅)에 storage 이벤트로 알림 → fresh fetch
        const invKey = INVALIDATION_KEY_MAP[type];
        if (invKey) {
          if (invKey === "import_schedule") {
            clearCacheByPrefix("inventory_import_schedule");
            clearCacheByPrefix("import_schedule_");
          }
          broadcastDataInvalidation(invKey);
        }

        onUploadComplete?.(type, json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "네트워크 오류";
        if (msg !== "cancelled" && msg !== "empty" && msg !== "invalid_file" && msg !== "column_mapping") {
          updateCard(type, { status: "error", message: msg });
        }
        throw e;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    statusResult, statusError, isChecking,
    cards, updateCard,
    uploadMode, setUploadMode,
    shipmentLastDates, paymentLastDates, inventoryLastDates,
    checkStatus, handleUpload,
  };
}
