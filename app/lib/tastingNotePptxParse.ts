// 시스템 템플릿 PPTX(테이스팅 노트) → wines 필드 역추출.
// AI 조사 없이 업로드된 노트의 라벨 구조(지역/품종/빈티지 + 와인명 카드)를 파싱한다.
// 임의 외부 양식은 대상 아님(라벨 매칭 실패 시 해당 필드만 비움).

import JSZip from "jszip";

export interface ParsedWineFields {
  item_name_kr?: string;
  item_name_en?: string;
  country_en?: string;
  region?: string;
  grape_varieties?: string;
  vintage?: string;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&"); // 마지막에 (이중 디코드 방지)
}

/** 한 shape(p:sp) 안의 문단별 텍스트 배열. 문단은 <a:t> 런들을 이어붙임. */
function shapeParagraphs(spXml: string): string[] {
  const paras: string[] = [];
  for (const p of spXml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)) {
    const runs = [...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
    if (runs.length) paras.push(decodeXml(runs.join("")).trim());
  }
  return paras;
}

/** shape의 세로 위치(EMU). off 없으면 큰 값(아래로 간주). 이름 카드는 본문보다 위에 있음. */
function shapeTop(spXml: string): number {
  const m = spXml.match(/<a:off x="-?\d+" y="(-?\d+)"/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

const NAME_MAX = 90; // 와인명 길이 상한(설명/양조 문단 오탐 배제)

const isEmptyVal = (v?: string) => !v || v === "-";
const norm = (v: string) => v.replace(/\s+/g, " ").trim(); // 연속 공백 정리

/**
 * 시스템 템플릿 PPTX 버퍼에서 와인 메타 필드를 추출.
 * - "지역" 라벨 다음 셀 = "{countryEn}, {region}" (첫 콤마로 분리)
 * - "품종" 라벨 다음 셀 = grape_varieties
 * - "빈티지" 라벨 다음 셀 = vintage
 * - 와인명 카드(한글 문단 + 영문 문단) = item_name_kr / item_name_en
 */
export async function parseWineFieldsFromPptx(buffer: Buffer): Promise<ParsedWineFields> {
  const zip = await JSZip.loadAsync(buffer);
  const slide = await zip.file("ppt/slides/slide1.xml")?.async("string");
  if (!slide) return {};

  // shape 순서대로 {문단들, 세로위치} 수집 (라벨→값은 인접 shape)
  const shapes: { paras: string[]; top: number }[] = [];
  for (const sp of slide.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
    const paras = shapeParagraphs(sp[1]);
    if (paras.length) shapes.push({ paras, top: shapeTop(sp[1]) });
  }
  const cells = shapes.map((s) => s.paras.join("\n"));

  // 라벨 바로 다음 셀의 값
  const valueAfter = (label: string): string | undefined => {
    const i = cells.findIndex((c) => c.trim() === label);
    return i >= 0 ? cells[i + 1]?.trim() : undefined;
  };

  const out: ParsedWineFields = {};

  // 지역(=국가영문, 지역) — info.ts: `${countryEn}, ${region}`
  const regionCell = valueAfter("지역");
  if (!isEmptyVal(regionCell)) {
    const idx = regionCell!.indexOf(", ");
    if (idx > 0) {
      out.country_en = norm(regionCell!.slice(0, idx));
      out.region = norm(regionCell!.slice(idx + 2));
    } else {
      out.region = norm(regionCell!);
    }
  }

  const grape = valueAfter("품종");
  if (!isEmptyVal(grape)) out.grape_varieties = norm(grape!);

  const vintage = valueAfter("빈티지");
  if (!isEmptyVal(vintage)) out.vintage = norm(vintage!);

  // 템플릿 게이트: 지역/품종/빈티지 라벨이 하나도 없으면 시스템 템플릿이 아님 → 이름 추출 안 함
  if (out.region == null && out.grape_varieties == null && out.vintage == null) {
    return {};
  }

  // 와인명 카드: (한글 문단 + 영문 문단) & 둘 다 짧음(설명/양조 배제) & 가장 위(min top)
  const nameCard = shapes
    .filter(
      (s) =>
        s.paras.length >= 2 &&
        /[가-힣]/.test(s.paras[0]) &&
        /[A-Za-z]/.test(s.paras[1]) &&
        !/[가-힣]/.test(s.paras[1]) && // 영문명 문단엔 한글 없어야(슬로건/와이너리 박스 배제)
        s.paras[0].length <= NAME_MAX &&
        s.paras[1].length <= NAME_MAX,
    )
    .sort((a, b) => a.top - b.top)[0];
  if (nameCard) {
    if (!isEmptyVal(nameCard.paras[0])) out.item_name_kr = norm(nameCard.paras[0]);
    if (!isEmptyVal(nameCard.paras[1])) out.item_name_en = norm(nameCard.paras[1]);
  }

  return out;
}
