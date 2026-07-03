// app/lib/adminUpload.ts
// 관리자 엑셀 업로드 → DB 교체 로직 (Supabase)
// 실제 구현은 admin-upload/ 하위 모듈에 분산되어 있고, 이 파일은 배럴 + 메인 디스패처.

import { logger } from "@/app/lib/logger";
import { validateXlsxBuffer } from "@/app/lib/validators";

import { saveUploadedFile } from "./admin-upload/storage";
import { UPLOAD_TYPES, type UploadType } from "./admin-upload/types";

import { processClient } from "./admin-upload/processClient";
import { processDlClient } from "./admin-upload/processDlClient";
import { processRiedel } from "./admin-upload/processRiedel";
import { processDownloads, processDl } from "./admin-upload/processInventory";
import { processEnglish } from "./admin-upload/processEnglish";

// 외부에서 참조하는 공개 API 재노출 (기존 import 경로 유지)
export { getUploadedFilePath, getAllUploadTimestamps } from "./admin-upload/storage";
export { UPLOAD_TYPES, isValidUploadType } from "./admin-upload/types";
export type { UploadType, ShipmentRow, PaymentRow, CarryoverRow } from "./admin-upload/types";
export { parseInventorySheet } from "./admin-upload/parseInventory";
export { processClientFromData } from "./admin-upload/processClient";
export { processDlClientFromData } from "./admin-upload/processDlClient";
export { processDownloadsFromData, processDlFromData } from "./admin-upload/processInventory";
export { processShipmentsFromData } from "./admin-upload/processShipments";
export { processClientInfoFromData } from "./admin-upload/processClientInfo";
export type { ClientInfoRow } from "./admin-upload/processClientInfo";
export {
  processPaymentsFromData,
  processCarryoverFromData,
  processDlPaymentsFromData,
  processDlCarryoverFromData,
} from "./admin-upload/processPayments";

export async function processUpload(type: UploadType, fileBuffer: Buffer) {
  logger.info(`Admin upload: processing type=${type}, size=${fileBuffer.length}`);

  // 파일 크기/MIME 검증 (zip bomb + 잘못된 파일 차단)
  const check = validateXlsxBuffer(fileBuffer);
  if (!check.ok) {
    throw new Error(`업로드 파일 검증 실패: ${check.error}`);
  }

  // 업로드 파일을 /tmp에 저장 (동기화 시 최신 파일 사용 가능)
  saveUploadedFile(type, fileBuffer);

  switch (type) {
    case "client":
      return await processClient(fileBuffer);
    case "dl-client":
      return await processDlClient(fileBuffer);
    case "riedel":
      return await processRiedel(fileBuffer);
    case "downloads":
      return await processDownloads(fileBuffer);
    case "dl":
      return await processDl(fileBuffer);
    case "english":
      return await processEnglish(fileBuffer);
    default:
      throw new Error(`지원하지 않는 업로드 타입: ${type as string}`);
  }
}

// 내부적으로 디스패처에서 필요해 UPLOAD_TYPES는 import만 남기고, 외부는 위에서 re-export됨.
void UPLOAD_TYPES;
