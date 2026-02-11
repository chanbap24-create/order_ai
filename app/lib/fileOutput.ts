// 파일 출력 유틸리티 - PPTX/PDF 저장 + PDF 변환

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { logger } from "@/app/lib/logger";

// 출력 디렉토리 (Vercel에서는 /tmp 사용)
const OUTPUT_BASE = process.env.VERCEL ? "/tmp/tasting-notes" : join(process.cwd(), "output", "tasting-notes");

/** 출력 디렉토리 확보 */
export function ensureOutputDir(): string {
  if (!existsSync(OUTPUT_BASE)) {
    mkdirSync(OUTPUT_BASE, { recursive: true });
  }
  return OUTPUT_BASE;
}

/** PPTX 파일 저장 */
export function savePptx(wineId: string, buffer: Buffer): string {
  const dir = ensureOutputDir();
  const filePath = join(dir, `${wineId}.pptx`);
  writeFileSync(filePath, buffer);
  logger.info(`[FileOutput] PPTX saved: ${filePath}`);
  return filePath;
}

/** PPTX → PDF 변환 (LibreOffice soffice 필요) */
export function convertToPdf(pptxPath: string): string | null {
  const dir = ensureOutputDir();
  const pdfPath = pptxPath.replace(/\.pptx$/, ".pdf");

  // soffice 경로 탐색
  const sofficePaths = [
    "soffice",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
  ];

  let sofficeBin: string | null = null;
  for (const p of sofficePaths) {
    try {
      execSync(`"${p}" --version`, { stdio: "ignore", timeout: 5000 });
      sofficeBin = p;
      break;
    } catch {
      continue;
    }
  }

  if (!sofficeBin) {
    logger.warn("[FileOutput] LibreOffice not found, skipping PDF conversion");
    return null;
  }

  try {
    execSync(`"${sofficeBin}" --headless --convert-to pdf --outdir "${dir}" "${pptxPath}"`, {
      timeout: 30000,
      stdio: "ignore",
    });

    if (existsSync(pdfPath)) {
      logger.info(`[FileOutput] PDF converted: ${pdfPath}`);
      return pdfPath;
    }
    return null;
  } catch (e) {
    logger.warn("[FileOutput] PDF conversion failed", { error: e });
    return null;
  }
}

/** 저장된 파일 읽기 */
export function readOutputFile(wineId: string, format: "pptx" | "pdf"): Buffer | null {
  const dir = ensureOutputDir();
  const filePath = join(dir, `${wineId}.${format}`);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath);
}

/** 저장된 파일 목록 조회 */
export function listOutputFiles(): { wineId: string; hasPptx: boolean; hasPdf: boolean }[] {
  const dir = ensureOutputDir();
  const files = readdirSync(dir);
  const wineMap = new Map<string, { hasPptx: boolean; hasPdf: boolean }>();

  for (const file of files) {
    const match = file.match(/^(.+)\.(pptx|pdf)$/);
    if (!match) continue;
    const [, wineId, ext] = match;
    const entry = wineMap.get(wineId) || { hasPptx: false, hasPdf: false };
    if (ext === "pptx") entry.hasPptx = true;
    if (ext === "pdf") entry.hasPdf = true;
    wineMap.set(wineId, entry);
  }

  return Array.from(wineMap.entries()).map(([wineId, status]) => ({ wineId, ...status }));
}

/** 저장된 파일 삭제 */
export function deleteOutputFiles(wineId: string): void {
  const dir = ensureOutputDir();
  for (const ext of ["pptx", "pdf"]) {
    const filePath = join(dir, `${wineId}.${ext}`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      logger.info(`[FileOutput] Deleted: ${filePath}`);
    }
  }
}
