// PPT 생성기 - python-pptx 기반 (child_process로 Python 호출)
// pptxgenjs 에서 python-pptx로 마이그레이션: PowerPoint 호환성 개선

import { execFile } from "child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { getWineByCode, getTastingNote } from "@/app/lib/wineDb";
import { downloadImageAsBase64 } from "@/app/lib/wineImageSearch";
import { LOGO_CAVEDEVIN_BASE64, ICON_AWARD_BASE64 } from "@/app/lib/pptAssets";
import { logger } from "@/app/lib/logger";

const execFileAsync = promisify(execFile);

// 임시 디렉토리
const TMP_DIR = process.env.VERCEL ? "/tmp" : join(process.cwd(), "output", "tmp");

// Python 실행 경로
const PYTHON_BIN = process.platform === "win32" ? "python" : "python3";
const SCRIPT_PATH = join(process.cwd(), "scripts", "generate_ppt.py");

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

// ─── 헬퍼: 임시 디렉토리 확보 ───
function ensureTmpDir(): string {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
  return TMP_DIR;
}

// ─── 헬퍼: base64 → 임시 파일 저장 ───
function saveBase64ToTmp(base64: string, filename: string): string {
  ensureTmpDir();
  const filePath = join(TMP_DIR, filename);
  writeFileSync(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

// ─── 헬퍼: 임시 파일 삭제 (조용히) ───
function cleanupTmp(paths: string[]) {
  for (const p of paths) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch { /* ignore */ }
  }
}

// ─── Python 실행 ───
async function execPython(inputPath: string, outputPath: string): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync(
      PYTHON_BIN,
      [SCRIPT_PATH, inputPath, outputPath],
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr) {
      logger.info(`[PPT Python] ${stderr.trim()}`);
    }

    // stdout에서 "OK" 확인
    if (!stdout.includes("OK")) {
      throw new Error(`Python script did not return OK. stdout: ${stdout}`);
    }
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    const msg = err.stderr || err.message || String(e);
    logger.error(`[PPT Python] Script failed: ${msg}`);
    throw new Error(`PPT 생성 Python 스크립트 실패: ${msg}`);
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

/** 단일 와인 테이스팅 노트 PPT 생성 */
export async function generateSingleWinePpt(wineId: string): Promise<Buffer> {
  return generateTastingNotePpt([wineId]);
}

/** 여러 와인의 테이스팅 노트 PPT 생성 */
export async function generateTastingNotePpt(wineIds: string[]): Promise<Buffer> {
  ensureTmpDir();

  const timestamp = Date.now();
  const tmpFiles: string[] = [];
  const slides: SlidePayload[] = [];

  // 로고/아이콘 base64 → 임시 파일
  const logoPath = saveBase64ToTmp(LOGO_CAVEDEVIN_BASE64, `logo_${timestamp}.jpg`);
  tmpFiles.push(logoPath);

  const iconPath = saveBase64ToTmp(ICON_AWARD_BASE64, `icon_${timestamp}.jpg`);
  tmpFiles.push(iconPath);

  let slideCount = 0;

  for (const wineId of wineIds) {
    const wine = getWineByCode(wineId);
    if (!wine) continue;

    const note = getTastingNote(wineId);

    // 이미지: DB에 저장된 image_url에서 다운로드
    let bottleImagePath: string | undefined;

    if (wine.image_url) {
      try {
        const imgData = await downloadImageAsBase64(wine.image_url);
        if (imgData) {
          const ext = imgData.mimeType.includes('png') ? 'png' : 'jpg';
          const imgFilename = `bottle_${wineId}_${timestamp}.${ext}`;
          bottleImagePath = saveBase64ToTmp(imgData.base64, imgFilename);
          tmpFiles.push(bottleImagePath);
          logger.info(`[PPT] Bottle image downloaded for ${wineId}`);
        }
      } catch {
        logger.warn(`[PPT] Image download failed for ${wineId}`);
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
    throw new Error("생성할 슬라이드가 없습니다.");
  }

  // JSON 입력 파일 작성
  const inputPath = join(TMP_DIR, `ppt_input_${timestamp}.json`);
  const outputPath = join(TMP_DIR, `ppt_output_${timestamp}.pptx`);
  tmpFiles.push(inputPath, outputPath);

  const payload = {
    slides,
    logoPath,
    iconPath,
  };

  writeFileSync(inputPath, JSON.stringify(payload, null, 2), "utf-8");

  try {
    // Python 실행
    await execPython(inputPath, outputPath);

    // 결과 읽기
    const pptBuffer = readFileSync(outputPath);
    logger.info(`PPT generated: ${slideCount} slides (python-pptx)`);

    return pptBuffer;
  } finally {
    // 임시 파일 정리
    cleanupTmp(tmpFiles);
  }
}
