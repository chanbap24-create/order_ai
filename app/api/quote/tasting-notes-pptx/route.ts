import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import JSZip from 'jszip';

export const maxDuration = 120;

const TASTING_NOTE_BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const TASTING_NOTE_INDEX_URL = `${TASTING_NOTE_BASE_URL}/tasting-notes-index.json`;

async function loadTastingNoteIndex(): Promise<Set<string>> {
  try {
    const res = await fetch(`${TASTING_NOTE_INDEX_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return new Set();
    const data = await res.json();
    const s = new Set<string>();
    for (const [k, v] of Object.entries(data.notes || {} as Record<string, any>)) {
      if ((v as any)?.exists) s.add(k);
    }
    return s;
  } catch {
    return new Set();
  }
}

/**
 * 여러 PPTX 파일을 하나로 병합 (같은 pptxgenjs 템플릿 전제)
 * - base(첫 파일)의 테마/레이아웃/마스터를 그대로 유지
 * - 추가 파일에서 slide XML + 미디어만 복사하여 추가
 */
async function mergePptxFiles(pptxBuffers: ArrayBuffer[]): Promise<Buffer> {
  if (pptxBuffers.length === 1) {
    return Buffer.from(pptxBuffers[0]);
  }

  const baseZip = await JSZip.loadAsync(pptxBuffers[0]);

  // base 상태 파악
  let slideCount = 1; // base에 slide1이 있음
  let mediaCount = 0;
  baseZip.folder('ppt/media')?.forEach(() => { mediaCount++; });

  // base의 presentation.xml.rels에서 최대 rId 파악
  let presRelsXml = await baseZip.file('ppt/_rels/presentation.xml.rels')!.async('string');
  let maxRId = 0;
  for (const m of presRelsXml.matchAll(/Id="rId(\d+)"/g)) {
    maxRId = Math.max(maxRId, parseInt(m[1], 10));
  }

  // presentation.xml에서 최대 sldId 파악
  let presentationXml = await baseZip.file('ppt/presentation.xml')!.async('string');
  let maxSldId = 256;
  for (const m of presentationXml.matchAll(/p:sldId id="(\d+)"/g)) {
    maxSldId = Math.max(maxSldId, parseInt(m[1], 10));
  }

  let contentTypesXml = await baseZip.file('[Content_Types].xml')!.async('string');

  for (let fi = 1; fi < pptxBuffers.length; fi++) {
    const srcZip = await JSZip.loadAsync(pptxBuffers[fi]);

    // 소스에서 slide1.xml (각 파일에 1장만 있음)
    const srcSlideFile = srcZip.file('ppt/slides/slide1.xml');
    if (!srcSlideFile) continue;

    slideCount++;
    maxRId++;
    maxSldId++;
    const newSlideName = `slide${slideCount}.xml`;
    const newRId = `rId${maxRId}`;

    // 1) 소스 슬라이드의 rels 파일 읽기 → 미디어 파일 복사 + 참조 갱신
    const srcSlideRelsFile = srcZip.file('ppt/slides/_rels/slide1.xml.rels');
    let newSlideRelsXml = '';

    if (srcSlideRelsFile) {
      let relsXml = await srcSlideRelsFile.async('string');

      // 미디어 파일 복사 (image1.jpg → merged_5.jpg 등)
      const mediaRefs = [...relsXml.matchAll(/Target="\.\.\/media\/([^"]+)"/g)];
      for (const ref of mediaRefs) {
        const srcMediaName = ref[1];
        const srcMediaFile = srcZip.file(`ppt/media/${srcMediaName}`);
        if (srcMediaFile) {
          mediaCount++;
          const ext = srcMediaName.split('.').pop() || 'png';
          const newMediaName = `merged_${mediaCount}.${ext}`;
          const data = await srcMediaFile.async('uint8array');
          baseZip.file(`ppt/media/${newMediaName}`, data);
          relsXml = relsXml.split(`../media/${srcMediaName}`).join(`../media/${newMediaName}`);
        }
      }

      // slideLayout 참조는 base의 slideLayout1을 사용 (같은 템플릿이므로)
      newSlideRelsXml = relsXml;
    }

    // 2) 슬라이드 XML 복사
    const slideXml = await srcSlideFile.async('string');
    baseZip.file(`ppt/slides/${newSlideName}`, slideXml);

    // 3) 슬라이드 rels 복사
    if (newSlideRelsXml) {
      baseZip.file(`ppt/slides/_rels/${newSlideName}.rels`, newSlideRelsXml);
    }

    // 4) [Content_Types].xml에 새 슬라이드 추가
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      `<Override PartName="/ppt/slides/${newSlideName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
    );

    // 5) presentation.xml.rels에 새 슬라이드 관계 추가
    presRelsXml = presRelsXml.replace(
      '</Relationships>',
      `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/${newSlideName}"/></Relationships>`
    );

    // 6) presentation.xml의 sldIdLst에 추가
    presentationXml = presentationXml.replace(
      '</p:sldIdLst>',
      `<p:sldId id="${maxSldId}" r:id="${newRId}"/></p:sldIdLst>`
    );
  }

  // 변경된 XML 저장
  baseZip.file('[Content_Types].xml', contentTypesXml);
  baseZip.file('ppt/_rels/presentation.xml.rels', presRelsXml);
  baseZip.file('ppt/presentation.xml', presentationXml);

  return baseZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function GET(request: NextRequest) {
  try {
    const manager = request.nextUrl.searchParams.get('manager') || '';

    let query = supabase
      .from('quote_items')
      .select('item_code, product_name, sort_order')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (manager) query = query.eq('manager', manager);

    const { data: quoteRows, error } = await query;
    if (error) throw error;
    if (!quoteRows || quoteRows.length === 0) {
      return NextResponse.json({ error: '견적서에 품목이 없습니다.' }, { status: 400 });
    }

    const noteIndex = await loadTastingNoteIndex();
    const itemCodes = quoteRows
      .map((r: any) => r.item_code)
      .filter((code: string) => code && noteIndex.has(code));

    if (itemCodes.length === 0) {
      return NextResponse.json({ error: '테이스팅 노트가 있는 와인이 없습니다.' }, { status: 404 });
    }

    // 개별 PPTX 다운로드
    const pptxBuffers: ArrayBuffer[] = [];
    for (const itemCode of itemCodes) {
      try {
        const res = await fetch(`${TASTING_NOTE_BASE_URL}/${itemCode}.pptx`);
        if (!res.ok) continue;
        pptxBuffers.push(await res.arrayBuffer());
      } catch {
        // skip
      }
    }

    if (pptxBuffers.length === 0) {
      return NextResponse.json({ error: 'PPTX 파일을 다운로드할 수 없습니다.' }, { status: 500 });
    }

    const mergedBuffer = await mergePptxFiles(pptxBuffers);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const clientName = request.nextUrl.searchParams.get('client_name') || '미지정';
    const filename = `테이스팅노트_${dateStr}_${clientName}.pptx`;

    return new NextResponse(mergedBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Tasting notes PPTX merge error:', error);
    return NextResponse.json(
      { error: '테이스팅 노트 PPTX 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
