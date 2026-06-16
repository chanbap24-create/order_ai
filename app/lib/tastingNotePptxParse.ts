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

/** shape의 좌상단 좌표(EMU). off 없으면 큰 값(맨 뒤로). */
function shapeOffset(spXml: string): { top: number; left: number } {
  const m = spXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
  return m
    ? { left: parseInt(m[1], 10), top: parseInt(m[2], 10) }
    : { left: Number.MAX_SAFE_INTEGER, top: Number.MAX_SAFE_INTEGER };
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

  // shape를 XML 문서순서로 수집(AC계열은 라벨→값이 문서순서로 인접).
  const shapes: { paras: string[]; top: number; left: number }[] = [];
  for (const sp of slide.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
    const paras = shapeParagraphs(sp[1]);
    if (paras.length) shapes.push({ paras, ...shapeOffset(sp[1]) });
  }
  const cells = shapes.map((s) => s.paras.join("\n"));

  const KNOWN_LABELS = new Set(["지역", "품종", "빈티지", "와이너리", "양조", "양조 방식"]);
  const isLabelText = (t: string) => KNOWN_LABELS.has(t.trim());

  // 좌표 기반 값 탐색(라벨 오른쪽 같은 행 / 바로 아래 최근접 non-label). BP 변형 레이아웃용.
  const ROW_TOL = 110000, ROW_GAP = 330000, COL_TOL = 460000; // EMU (≈0.12/0.36/0.5인치)
  const valueByGeometry = (li: number): string | undefined => {
    const L = shapes[li];
    let best: { d: number; t: string } | undefined;
    for (let j = 0; j < shapes.length; j++) {
      if (j === li) continue;
      const s = shapes[j];
      const t = s.paras.join("\n").trim();
      if (!t || isLabelText(t)) continue;
      const sameRowRight = Math.abs(s.top - L.top) <= ROW_TOL && s.left > L.left;
      const below = s.top > L.top && s.top - L.top <= ROW_GAP && Math.abs(s.left - L.left) <= COL_TOL;
      if (!sameRowRight && !below) continue;
      const d = Math.abs(s.top - L.top) + Math.abs(s.left - L.left);
      if (!best || d < best.d) best = { d, t };
    }
    return best?.t;
  };

  // 라벨 값: 문서순서 다음 셀 우선, 그게 라벨이거나 비면 좌표 폴백.
  const valueAfter = (label: string): string | undefined => {
    const i = cells.findIndex((c) => c.trim() === label);
    if (i < 0) return undefined;
    const docNext = cells[i + 1]?.trim();
    if (docNext && !isLabelText(docNext)) return docNext;
    return valueByGeometry(i);
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

  // 주: 브랜드(생산자)명은 노트에서 추출하지 않는다 — brands 자료실(brand_code)에서 조회(addItem).
  return out;
}

export interface ParsedTastingNote {
  winemaking?: string;
  winery_description?: string;
  color_note?: string;
  nose_note?: string;
  palate_note?: string;
  vintage_note?: string;
  food_pairing?: string;
  glass_pairing?: string;
  aging_potential?: string;
  serving_temp?: string;
}

// 발행된 노트 PPTX의 라벨 집합(2종 템플릿 공통). 값 셀이 라벨로 오인되지 않게 한다.
const TN_LABELS = new Set([
  "지역", "품종", "빈티지", "포도밭", "와이너리", "양조", "양조 방식", "양조방식",
  "테이스팅 노트", "테이스팅노트", "푸드 페어링", "글라스 페어링", "수상내역", "수상 경력",
  "COLOR", "NOSE", "PALATE", "FOOD MATCHING", "STYLE", "BODY", "Dry", "Sweet", "Light", "Full",
]);

/**
 * 발행된 테이스팅노트 PPTX에서 "텍스트 내용"(양조·와이너리·색/향/맛·빈티지노트·페어링)을 역추출.
 * AI 조사 없이 이미 만들어진 노트의 내용을 그대로 가져온다. 2종 템플릿 모두 대응:
 *  - A형: 라벨 아래 값 셀(테이스팅 노트는 컬러/노즈/팔렛/잠재력/서빙 서브라벨 한 박스)
 *  - B형: COLOR/NOSE/PALATE 라벨 오른쪽 값 + "양조 방식" 라벨
 * 매칭 실패한 필드는 비워 둔다(best-effort).
 */
export async function parseTastingNotesFromPptx(buffer: Buffer): Promise<ParsedTastingNote> {
  const zip = await JSZip.loadAsync(buffer);
  const slide = await zip.file("ppt/slides/slide1.xml")?.async("string");
  if (!slide) return {};

  const shapes: { paras: string[]; top: number; left: number }[] = [];
  for (const sp of slide.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
    const paras = shapeParagraphs(sp[1]);
    if (paras.length) shapes.push({ paras, ...shapeOffset(sp[1]) });
  }

  const isLabel = (t: string) => TN_LABELS.has((t || "").trim());
  // 라벨 기준 값 셀: 같은 행 오른쪽(B형) 또는 바로 아래(A형) 최근접 non-label. (EMU)
  const ROW_TOL = 140000, ROW_GAP = 360000, COL_TOL = 480000;
  const findValueShape = (li: number) => {
    const L = shapes[li];
    let best: { d: number; s: (typeof shapes)[number] } | undefined;
    for (let j = 0; j < shapes.length; j++) {
      if (j === li) continue;
      const s = shapes[j];
      if (!s.paras.join("\n").trim() || isLabel(s.paras[0])) continue;
      const sameRowRight = Math.abs(s.top - L.top) <= ROW_TOL && s.left > L.left;
      const below = s.top > L.top && s.top - L.top <= ROW_GAP && Math.abs(s.left - L.left) <= COL_TOL;
      if (!sameRowRight && !below) continue;
      const d = Math.abs(s.top - L.top) + Math.abs(s.left - L.left);
      if (!best || d < best.d) best = { d, s };
    }
    return best?.s;
  };
  const labelIdx = (label: string) => shapes.findIndex((s) => s.paras[0]?.trim() === label);
  const valShapeOf = (...labels: string[]) => {
    for (const l of labels) {
      const i = labelIdx(l);
      if (i >= 0) {
        const v = findValueShape(i);
        if (v) return v;
      }
    }
    return undefined;
  };
  const clean = (v: string) => norm(v || "");

  const out: ParsedTastingNote = {};

  const wm = valShapeOf("양조", "양조 방식", "양조방식");
  if (wm) out.winemaking = clean(wm.paras.join("\n")) || undefined;

  const wd = valShapeOf("포도밭", "와이너리");
  if (wd) out.winery_description = clean(wd.paras.join(" ")) || undefined;

  const fp = valShapeOf("푸드 페어링", "FOOD MATCHING");
  if (fp) out.food_pairing = clean(fp.paras.join(", ")) || undefined;

  const gp = valShapeOf("글라스 페어링");
  if (gp) out.glass_pairing = clean(gp.paras.join(", ")) || undefined;

  // 빈티지 라벨: 값이 연도 숫자면 빈티지(다른 곳에서 처리), 산문이면 빈티지 노트.
  const vn = valShapeOf("빈티지");
  if (vn) {
    const t = clean(vn.paras.join(" "));
    if (t && !/^['‘’]?\d{2,4}\s*년?\.?$/.test(t)) out.vintage_note = t;
  }

  // A형: "테이스팅 노트" 한 박스 안의 서브라벨(컬러/노즈/팔렛/잠재력/서빙)
  const tn = valShapeOf("테이스팅 노트", "테이스팅노트");
  if (tn) {
    for (const p of tn.paras) {
      const m = p.match(/^\s*(컬러|노즈|팔렛|팔레트|잠재력|서빙\s*온도)\s*[:：]\s*(.+)$/);
      if (!m) continue;
      const v = clean(m[2]);
      if (!v) continue;
      if (m[1].startsWith("컬러")) out.color_note = v;
      else if (m[1].startsWith("노즈")) out.nose_note = v;
      else if (m[1].startsWith("팔")) out.palate_note = v;
      else if (m[1].startsWith("잠재력")) out.aging_potential = v;
      else out.serving_temp = v;
    }
  }
  // B형: COLOR/NOSE/PALATE 개별 라벨(값 오른쪽)
  if (!out.color_note) { const c = valShapeOf("COLOR"); if (c) out.color_note = clean(c.paras.join(" ")) || undefined; }
  if (!out.nose_note) { const n = valShapeOf("NOSE"); if (n) out.nose_note = clean(n.paras.join(" ")) || undefined; }
  if (!out.palate_note) { const p = valShapeOf("PALATE"); if (p) out.palate_note = clean(p.paras.join(" ")) || undefined; }

  return out;
}

/**
 * PPTX 슬라이드에서 와인병 이미지를 추출.
 * 표시 면적이 가장 크고 세로로 긴(세로비율>1.3) <p:pic> 을 병으로 판별 →
 * 해당 미디어 바이트를 반환. (파일 크기가 아닌 슬라이드 배치 기준이라 배경/로고와 구분됨)
 * 병을 못 찾으면 null.
 */
export async function extractBottleImageFromPptx(
  buffer: Buffer,
): Promise<{ base64: string; mime: string; ext: string } | null> {
  const zip = await JSZip.loadAsync(buffer);
  const slide = await zip.file("ppt/slides/slide1.xml")?.async("string");
  const rels = await zip.file("ppt/slides/_rels/slide1.xml.rels")?.async("string");
  if (!slide || !rels) return null;

  // rId → media 파일명
  const ridToMedia: Record<string, string> = {};
  for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g)) {
    ridToMedia[m[1]] = m[2];
  }

  // 병 선택: 가로형(라벨/배너) 제외(비율≥0.85 — 정사각·세로 허용) + 최소 면적(작은 로고 제외) 중 표시 면적 최대.
  const EMU = 914400;
  const MIN_RATIO = 0.85; // cy/cx 미만이면 가로형으로 보고 제외
  const MIN_AREA = 3 * EMU * EMU; // 3 sq-inch 미만은 로고/아이콘
  let best: { area: number; media: string } | null = null;
  for (const pic of slide.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
    const blk = pic[1];
    const emb = blk.match(/r:embed="(rId\d+)"/);
    const ext = blk.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!emb || !ext) continue;
    const cx = parseInt(ext[1], 10);
    const cy = parseInt(ext[2], 10);
    if (cx <= 0 || cy <= 0 || cy / cx < MIN_RATIO) continue; // 가로형 라벨/배너 제외
    const area = cx * cy;
    if (area < MIN_AREA) continue; // 너무 작은 로고/아이콘 제외
    const media = ridToMedia[emb[1]];
    if (!media) continue;
    if (!best || area > best.area) best = { area, media };
  }
  if (!best) return null;

  const file = zip.file(`ppt/media/${best.media}`);
  if (!file) return null;
  const bytes = await file.async("nodebuffer");
  const rawExt = (best.media.split(".").pop() || "png").toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  const mime = ext === "png" ? "image/png" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return { base64: bytes.toString("base64"), mime, ext };
}
