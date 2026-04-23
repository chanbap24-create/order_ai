import fs from "fs";
import path from "path";
import { logger } from "@/app/lib/logger";

const UPLOAD_DIR = "/tmp/admin-uploads";

export function saveUploadedFile(type: string, buf: Buffer) {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, `${type}.xlsx`);
    fs.writeFileSync(filePath, buf);
    logger.info(`Admin upload: saved file to ${filePath}`);
  } catch (e) {
    logger.warn("Failed to save uploaded file to /tmp (non-fatal)", { error: e });
  }
}

export function getUploadedFilePath(type: string): string | null {
  const filePath = path.join(UPLOAD_DIR, `${type}.xlsx`);
  return fs.existsSync(filePath) ? filePath : null;
}

export function getAllUploadTimestamps(): Record<string, string | null> {
  const types = ["client", "dl-client", "riedel", "downloads", "dl", "english"];
  const result: Record<string, string | null> = {};
  for (const type of types) {
    const filePath = path.join(UPLOAD_DIR, `${type}.xlsx`);
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        result[type] = stat.mtime.toISOString();
      } else {
        result[type] = null;
      }
    } catch {
      result[type] = null;
    }
  }
  return result;
}
