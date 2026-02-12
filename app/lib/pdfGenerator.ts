// PDF 생성기 - Python reportlab 기반 (pptGenerator.ts와 동일한 패턴)
// generate_pdf.py가 generate_ppt.py와 동일한 디자인 시스템을 공유하여 PPTX↔PDF 일관성 보장

import { execFile } from "child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64, searchVivinoBottleImage } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";

const execFileAsync = promisify(execFile);

const TMP_DIR = process.env.VERCEL ? "/tmp" : join(process.cwd(), "output", "tmp");
const PYTHON_BIN = process.platform === "win32" ? "python" : "python3";
const SCRIPT_PATH = join(process.cwd(), "scripts", "generate_pdf.py");

// ─── 헬퍼: 빈티지 2자리→4자리 변환 ───
function formatVintage4(v: string): string {
  if (!v || v === '-') return '-';
  if (/^(NV|MV)$/i.test(v)) return v.toUpperCase();
  if (/^\d{4}$/.test(v)) return v;
  const num = parseInt(v, 10);
  if (!isNaN(num)) {
    return num >= 50 ? `19${String(num).padStart(2, '0')}` : `20${String(num).padStart(2, '0')}`;
  }
  return v;
}

function ensureTmpDir(): string {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
  return TMP_DIR;
}

function saveBase64ToTmp(base64: string, filename: string): string {
  ensureTmpDir();
  const filePath = join(TMP_DIR, filename);
  writeFileSync(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

function cleanupTmp(paths: string[]) {
  for (const p of paths) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch { /* ignore */ }
  }
}

async function execPython(inputPath: string, outputPath: string): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync(
      PYTHON_BIN,
      [SCRIPT_PATH, inputPath, outputPath],
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr) {
      logger.info(`[PDF Python] ${stderr.trim()}`);
    }

    if (!stdout.includes("OK")) {
      throw new Error(`Python script did not return OK. stdout: ${stdout}`);
    }
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    const msg = err.stderr || err.message || String(e);
    logger.error(`[PDF Python] Script failed: ${msg}`);
    throw new Error(`PDF 생성 Python 스크립트 실패: ${msg}`);
  }
}

interface SlidePayload {
  nameKr: string;
  nameEn: string;
  country: string;
  countryEn: string;
  region: string;
  grapeVarieties: string;
  vintage: string;
  vintageNote: string;
  wineryDescription: string;
  winemaking: string;
  alcoholPercentage: string;
  agingPotential: string;
  colorNote: string;
  noseNote: string;
  palateNote: string;
  foodPairing: string;
  glassPairing: string;
  servingTemp: string;
  awards: string;
  bottleImagePath?: string;
}

/** 단일 와인 PDF 생성 */
export async function generateSingleWinePdf(wineId: string): Promise<Buffer> {
  return generateTastingNotePdf([wineId]);
}

/** 여러 와인의 테이스팅 노트 PDF 생성 */
export async function generateTastingNotePdf(wineIds: string[]): Promise<Buffer> {
  ensureTmpDir();

  const timestamp = Date.now();
  const tmpFiles: string[] = [];
  const slides: SlidePayload[] = [];

  // 로고/아이콘 base64 → 임시 파일
  const logoPath = saveBase64ToTmp(LOGO_CAVEDEVIN_BASE64, `pdf_logo_${timestamp}.jpg`);
  tmpFiles.push(logoPath);

  const iconPath = saveBase64ToTmp(ICON_AWARD_BASE64, `pdf_icon_${timestamp}.jpg`);
  tmpFiles.push(iconPath);

  let slideCount = 0;

  for (const wineId of wineIds) {
    const wine = await getWineByCode(wineId);
    if (!wine) continue;

    const note = await getTastingNote(wineId);

    // 이미지: Vivino 누끼 우선 → 기존 image_url 폴백
    let bottleImagePath: string | undefined;

    const engName = wine.item_name_en;
    if (engName) {
      try {
        const vivinoUrl = await searchVivinoBottleImage(engName);
        if (vivinoUrl) {
          const imgData = await downloadImageAsBase64(vivinoUrl);
          if (imgData) {
            const ext = imgData.mimeType.includes('png') ? 'png' : 'jpg';
            const imgFilename = `pdf_bottle_${wineId}_${timestamp}.${ext}`;
            bottleImagePath = saveBase64ToTmp(imgData.base64, imgFilename);
            tmpFiles.push(bottleImagePath);
            logger.info(`[PDF] Vivino nukki image for ${wineId}`);
          }
        }
      } catch {
        logger.warn(`[PDF] Vivino search failed for ${wineId}`);
      }
    }

    if (!bottleImagePath && wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          const ext = imgData.mimeType.includes('png') ? 'png' : 'jpg';
          const imgFilename = `pdf_bottle_${wineId}_${timestamp}.${ext}`;
          bottleImagePath = saveBase64ToTmp(imgData.base64, imgFilename);
          tmpFiles.push(bottleImagePath);
          logger.info(`[PDF] Fallback image for ${wineId}`);
        }
      } catch {
        logger.warn(`[PDF] Image download failed for ${wineId}`);
      }
    }

    slides.push({
      nameKr: wine.item_name_kr,
      nameEn: wine.item_name_en || '',
      country: wine.country || '',
      countryEn: wine.country_en || '',
      region: wine.region || '',
      grapeVarieties: wine.grape_varieties || '',
      vintage: formatVintage4(wine.vintage || ''),
      vintageNote: note?.vintage_note || '',
      wineryDescription: note?.winery_description || '',
      winemaking: note?.winemaking || '',
      alcoholPercentage: wine.alcohol || '',
      agingPotential: note?.aging_potential || '',
      colorNote: note?.color_note || '',
      noseNote: note?.nose_note || '',
      palateNote: note?.palate_note || '',
      foodPairing: note?.food_pairing || '',
      glassPairing: note?.glass_pairing || '',
      servingTemp: note?.serving_temp || '',
      awards: note?.awards || '',
      bottleImagePath,
    });
    slideCount++;
  }

  if (slideCount === 0) {
    cleanupTmp(tmpFiles);
    throw new Error("생성할 페이지가 없습니다.");
  }

  // JSON 입력 파일 작성
  const inputPath = join(TMP_DIR, `pdf_input_${timestamp}.json`);
  const outputPath = join(TMP_DIR, `pdf_output_${timestamp}.pdf`);
  tmpFiles.push(inputPath, outputPath);

  const payload = {
    slides,
    logoPath,
    iconPath,
  };

  writeFileSync(inputPath, JSON.stringify(payload, null, 2), "utf-8");

  try {
    await execPython(inputPath, outputPath);

    const pdfBuffer = readFileSync(outputPath);
    logger.info(`[PDF] Generated: ${slideCount} pages (reportlab)`);

    return pdfBuffer;
  } finally {
    cleanupTmp(tmpFiles);
  }
}
