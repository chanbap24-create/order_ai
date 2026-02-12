/**
 * PPTX 폰트 임베딩 유틸리티
 * OOXML (ECMA-376) 스펙에 따라 TTF 폰트를 PPTX에 임베딩
 * → 받는 사람 PC에 폰트가 없어도 정상 표시
 */

import * as JSZip from "jszip";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { logger } from "@/app/lib/logger";

interface FontToEmbed {
  typeface: string; // PPT에서 사용하는 폰트명
  ttfPath: string; // TTF 파일 경로
}

/**
 * OOXML 폰트 난독화 (ECMA-376 Part 2, §13.1)
 * GUID 기반 XOR로 TTF 첫 32바이트를 난독화
 */
function obfuscateFont(fontData: Buffer, guid: string): Buffer {
  const hex = guid.replace(/[-{}]/g, ""); // 32 hex chars
  // 역순 바이트 페어로 16바이트 키 생성
  const key = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    key[i] = parseInt(hex.substr((15 - i) * 2, 2), 16);
  }

  const result = Buffer.from(fontData);
  for (let i = 0; i < 32; i++) {
    result[i] ^= key[i % 16];
  }
  return result;
}

/**
 * PPTX 버퍼에 폰트를 임베딩하여 반환
 */
export async function embedFontsInPptx(pptxBuffer: Buffer): Promise<Buffer> {
  const fonts: FontToEmbed[] = [
    {
      typeface: "Gowun Dodum",
      ttfPath: join(process.cwd(), "data", "fonts", "GowunDodum-Regular.ttf"),
    },
  ];

  // 폰트 파일 읽기
  const validFonts: { typeface: string; data: Buffer }[] = [];
  for (const font of fonts) {
    try {
      const data = readFileSync(font.ttfPath);
      validFonts.push({ typeface: font.typeface, data });
    } catch {
      logger.warn(`[PPT Font] Font not found: ${font.ttfPath}`);
    }
  }

  if (validFonts.length === 0) {
    return pptxBuffer;
  }

  const zip = await JSZip.loadAsync(pptxBuffer);

  // 폰트별 처리
  const embedEntries: { typeface: string; rId: string }[] = [];

  for (let idx = 0; idx < validFonts.length; idx++) {
    const { typeface, data } = validFonts[idx];
    const guid = randomUUID();
    const guidUpper = guid.toUpperCase();
    const fontFileName = `{${guidUpper}}.fntdata`;
    const rId = `rIdEmbedFont${idx + 1}`;

    // 난독화 후 ZIP에 추가
    const obfuscated = obfuscateFont(data, guid);
    zip.file(`ppt/fonts/${fontFileName}`, obfuscated);

    // [Content_Types].xml 업데이트
    const ctFile = zip.file("[Content_Types].xml");
    if (ctFile) {
      let ct = await ctFile.async("string");
      ct = ct.replace(
        "</Types>",
        `<Override PartName="/ppt/fonts/${fontFileName}" ContentType="application/x-fontdata"/></Types>`
      );
      zip.file("[Content_Types].xml", ct);
    }

    // ppt/_rels/presentation.xml.rels 업데이트
    const relsFile = zip.file("ppt/_rels/presentation.xml.rels");
    if (relsFile) {
      let rels = await relsFile.async("string");
      rels = rels.replace(
        "</Relationships>",
        `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${fontFileName}"/></Relationships>`
      );
      zip.file("ppt/_rels/presentation.xml.rels", rels);
    }

    embedEntries.push({ typeface, rId });
  }

  // ppt/presentation.xml에 embeddedFontLst 추가
  const presFile = zip.file("ppt/presentation.xml");
  if (presFile && embedEntries.length > 0) {
    let pres = await presFile.async("string");

    const fontListXml = embedEntries
      .map(
        (e) =>
          `<p:embeddedFont><p:font typeface="${e.typeface}"/><p:regular r:id="${e.rId}"/></p:embeddedFont>`
      )
      .join("");

    pres = pres.replace(
      "</p:presentation>",
      `<p:embeddedFontLst>${fontListXml}</p:embeddedFontLst></p:presentation>`
    );
    zip.file("ppt/presentation.xml", pres);
  }

  const result = (await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  })) as Buffer;

  logger.info(
    `[PPT Font] Embedded ${embedEntries.length} font(s) in PPTX`
  );
  return result;
}
