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
 * PPTX 파일들을 병합 (JSZip 기반 슬라이드 XML 합치기)
 * 첫 번째 PPTX를 base로 하고, 나머지 PPTX의 슬라이드를 추가
 */
async function mergePptxFiles(pptxBuffers: ArrayBuffer[]): Promise<Buffer> {
  if (pptxBuffers.length === 1) {
    return Buffer.from(pptxBuffers[0]);
  }

  const baseZip = await JSZip.loadAsync(pptxBuffers[0]);

  // base의 기존 슬라이드 수 파악
  let slideCount = 0;
  let relCount = 0;
  baseZip.folder('ppt/slides')?.forEach((path) => {
    if (/^slide\d+\.xml$/.test(path)) slideCount++;
  });
  baseZip.folder('ppt/slides/_rels')?.forEach((path) => {
    if (/^slide\d+\.xml\.rels$/.test(path)) relCount++;
  });

  // [Content_Types].xml 파싱
  let contentTypesXml = await baseZip.file('[Content_Types].xml')!.async('string');

  // presentation.xml 파싱
  let presentationXml = await baseZip.file('ppt/presentation.xml')!.async('string');

  // presentation.xml.rels 파싱
  let presRelsXml = await baseZip.file('ppt/_rels/presentation.xml.rels')!.async('string');

  // base의 최대 rId 번호 파악
  let maxRId = 0;
  const ridMatches = presRelsXml.matchAll(/Id="rId(\d+)"/g);
  for (const m of ridMatches) {
    maxRId = Math.max(maxRId, parseInt(m[1], 10));
  }

  // 미디어 파일 인덱스 (충돌 방지)
  let mediaIndex = 0;
  baseZip.folder('ppt/media')?.forEach(() => { mediaIndex++; });

  for (let fileIdx = 1; fileIdx < pptxBuffers.length; fileIdx++) {
    const srcZip = await JSZip.loadAsync(pptxBuffers[fileIdx]);

    // 소스 PPTX의 슬라이드 목록
    const srcSlides: string[] = [];
    srcZip.folder('ppt/slides')?.forEach((path) => {
      if (/^slide\d+\.xml$/.test(path)) srcSlides.push(path);
    });
    srcSlides.sort((a, b) => {
      const na = parseInt(a.match(/\d+/)![0], 10);
      const nb = parseInt(b.match(/\d+/)![0], 10);
      return na - nb;
    });

    for (const srcSlideName of srcSlides) {
      slideCount++;
      maxRId++;
      const newSlideName = `slide${slideCount}.xml`;
      const newRId = `rId${maxRId}`;

      // 슬라이드 XML 복사
      let slideXml = await srcZip.file(`ppt/slides/${srcSlideName}`)!.async('string');

      // 슬라이드 내 미디어 참조 처리
      const srcSlideRelsPath = `ppt/slides/_rels/${srcSlideName}.rels`;
      const srcSlideRelsFile = srcZip.file(srcSlideRelsPath);
      let newSlideRelsXml = '';

      if (srcSlideRelsFile) {
        let slideRelsXml = await srcSlideRelsFile.async('string');

        // 미디어 파일 복사 및 참조 갱신
        const mediaMatches = slideRelsXml.matchAll(/Target="\.\.\/media\/([^"]+)"/g);
        for (const mm of mediaMatches) {
          const srcMediaName = mm[1];
          const srcMediaFile = srcZip.file(`ppt/media/${srcMediaName}`);
          if (srcMediaFile) {
            mediaIndex++;
            const ext = srcMediaName.split('.').pop() || 'png';
            const newMediaName = `merged${mediaIndex}.${ext}`;
            const mediaData = await srcMediaFile.async('uint8array');
            baseZip.file(`ppt/media/${newMediaName}`, mediaData);
            slideRelsXml = slideRelsXml.replace(
              `../media/${srcMediaName}`,
              `../media/${newMediaName}`
            );

            // Content_Types에 확장자 추가 (중복 무시)
            if (!contentTypesXml.includes(`Extension="${ext}"`)) {
              const mimeMap: Record<string, string> = {
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                gif: 'image/gif', tiff: 'image/tiff', svg: 'image/svg+xml',
                emf: 'image/x-emf', wmf: 'image/x-wmf',
              };
              const mime = mimeMap[ext] || 'application/octet-stream';
              contentTypesXml = contentTypesXml.replace(
                '</Types>',
                `<Default Extension="${ext}" ContentType="${mime}"/></Types>`
              );
            }
          }
        }

        // slideLayout 참조를 base의 slideLayout1로 치환
        slideRelsXml = slideRelsXml.replace(
          /Target="\.\.\/slideLayouts\/slideLayout\d+\.xml"/g,
          'Target="../slideLayouts/slideLayout1.xml"'
        );

        newSlideRelsXml = slideRelsXml;
      }

      // 슬라이드 파일 추가
      baseZip.file(`ppt/slides/${newSlideName}`, slideXml);
      if (newSlideRelsXml) {
        baseZip.file(`ppt/slides/_rels/${newSlideName}.rels`, newSlideRelsXml);
      }

      // Content_Types에 슬라이드 추가
      contentTypesXml = contentTypesXml.replace(
        '</Types>',
        `<Override PartName="/ppt/slides/${newSlideName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
      );

      // presentation.xml에 슬라이드 참조 추가
      presentationXml = presentationXml.replace(
        '</p:sldIdLst>',
        `<p:sldId id="${256 + slideCount}" r:id="${newRId}"/></p:sldIdLst>`
      );

      // presentation.xml.rels에 관계 추가
      presRelsXml = presRelsXml.replace(
        '</Relationships>',
        `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/${newSlideName}"/></Relationships>`
      );
    }
  }

  // 업데이트된 파일 저장
  baseZip.file('[Content_Types].xml', contentTypesXml);
  baseZip.file('ppt/presentation.xml', presentationXml);
  baseZip.file('ppt/_rels/presentation.xml.rels', presRelsXml);

  const merged = await baseZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return merged;
}

export async function GET(request: NextRequest) {
  try {
    const manager = request.nextUrl.searchParams.get('manager') || '';

    // 견적서 품목 조회 (sort_order 순)
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

    // 테이스팅 노트 존재 여부 확인
    const noteIndex = await loadTastingNoteIndex();
    const itemCodes = quoteRows
      .map((r: any) => r.item_code)
      .filter((code: string) => code && noteIndex.has(code));

    if (itemCodes.length === 0) {
      return NextResponse.json({ error: '테이스팅 노트가 있는 와인이 없습니다.' }, { status: 404 });
    }

    // 개별 PPTX 다운로드
    const pptxBuffers: ArrayBuffer[] = [];
    const skipped: string[] = [];

    for (const itemCode of itemCodes) {
      try {
        const res = await fetch(`${TASTING_NOTE_BASE_URL}/${itemCode}.pptx`);
        if (!res.ok) { skipped.push(itemCode); continue; }
        pptxBuffers.push(await res.arrayBuffer());
      } catch {
        skipped.push(itemCode);
      }
    }

    if (pptxBuffers.length === 0) {
      return NextResponse.json({ error: 'PPTX 파일을 다운로드할 수 없습니다.' }, { status: 500 });
    }

    // PPTX 병합
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
