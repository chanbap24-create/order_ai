import JSZip from 'jszip';
import { IMAGE_CELL_PX } from './types';

const EMU_PER_PX = 9525;

/**
 * ExcelJS 는 twoCell 앵커 그림의 xfrm 크기를 `<a:ext cx="0" cy="0"/>` 로 기록한다.
 * MS Excel 은 앵커(from/to)로 크기를 역산해 문제없지만, 앵커를 계산하지 못하는
 * 뷰어(모바일/카톡 미리보기, 한컴 등)는 xfrm 값을 그대로 사용해 이미지가
 * 안 보이거나 원본 픽셀 크기로 렌더돼 셀 아래로 잘린다.
 *
 * 생성된 xlsx zip 의 drawing XML 에서 twoCellAnchor 내부의 0 크기 xfrm 을
 * 셀 크기(IMAGE_CELL_PX)로 바꿔 fallback 뷰어에서도 올바른 크기로 보이게 한다.
 */
export async function patchDrawingExt(buffer: ArrayBuffer | Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const cx = IMAGE_CELL_PX.w * EMU_PER_PX;
  const cy = IMAGE_CELL_PX.h * EMU_PER_PX;

  const names = Object.keys(zip.files).filter((f) =>
    /^xl\/drawings\/drawing\d+\.xml$/.test(f),
  );
  for (const name of names) {
    const xml = await zip.file(name)!.async('string');
    // twoCellAnchor 블록 안의 ext=0 만 교체 (oneCellAnchor 로고는 건드리지 않음)
    const patched = xml.replace(
      /<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g,
      (block) => block.replace('<a:ext cx="0" cy="0"/>', `<a:ext cx="${cx}" cy="${cy}"/>`),
    );
    if (patched !== xml) zip.file(name, patched);
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Promise<Buffer>;
}
