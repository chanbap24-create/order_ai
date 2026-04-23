import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "@/app/lib/logger";

const FONT_DIR = process.env.VERCEL ? "/tmp/fonts" : join(process.cwd(), "output", "fonts");
const FONT_REGULAR = "NotoSansKR-Regular.otf";
const FONT_BOLD = "NotoSansKR-Bold.otf";

const FONT_SOURCES = [
  {
    regular: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
    bold: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf",
  },
  {
    regular: "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf",
    bold: "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf",
  },
];

const SYSTEM_FONTS_WIN = [
  "C:\\Windows\\Fonts\\malgun.ttf",
  "C:\\Windows\\Fonts\\malgunbd.ttf",
];

export interface FontPaths {
  regular: string;
  bold: string;
}

export async function ensureKoreanFont(): Promise<FontPaths | null> {
  if (process.platform === "win32" && existsSync(SYSTEM_FONTS_WIN[0]) && existsSync(SYSTEM_FONTS_WIN[1])) {
    return { regular: SYSTEM_FONTS_WIN[0], bold: SYSTEM_FONTS_WIN[1] };
  }

  const regularPath = join(FONT_DIR, FONT_REGULAR);
  const boldPath = join(FONT_DIR, FONT_BOLD);
  if (existsSync(regularPath) && existsSync(boldPath)) {
    return { regular: regularPath, bold: boldPath };
  }

  mkdirSync(FONT_DIR, { recursive: true });

  for (const source of FONT_SOURCES) {
    try {
      logger.info(`[PDF] Downloading Korean font from CDN...`);
      const [regularRes, boldRes] = await Promise.all([
        fetch(source.regular, { signal: AbortSignal.timeout(20000) }),
        fetch(source.bold, { signal: AbortSignal.timeout(20000) }),
      ]);

      if (!regularRes.ok || !boldRes.ok) continue;

      const regularBuf = Buffer.from(await regularRes.arrayBuffer());
      const boldBuf = Buffer.from(await boldRes.arrayBuffer());

      // 폰트 파일은 최소 100KB
      if (regularBuf.length < 100000 || boldBuf.length < 100000) continue;

      writeFileSync(regularPath, regularBuf);
      writeFileSync(boldPath, boldBuf);

      logger.info(`[PDF] Korean font cached: ${regularBuf.length + boldBuf.length} bytes`);
      return { regular: regularPath, bold: boldPath };
    } catch (e) {
      logger.warn(`[PDF] Font download failed, trying next source...`, { error: e });
      continue;
    }
  }

  logger.warn("[PDF] Korean font not available, using Helvetica fallback");
  return null;
}
