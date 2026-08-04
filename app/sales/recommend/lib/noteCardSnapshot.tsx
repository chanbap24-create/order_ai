'use client';

// 인벤토리의 기존 테이스팅노트 카드(TastingNoteDbCard)를 그대로 오프스크린 렌더 →
// PNG 캡처. 상세카드 이미지에 이어붙이는 용도 — 카드 디자인·데이터 소스 재사용.
import { createRoot } from 'react-dom/client';
import * as htmlToImage from 'html-to-image';
import { TastingNoteDbCard } from '@/app/inventory/components/TastingNoteDbCard';

export async function renderNoteCardImage(itemNo: string, itemName: string): Promise<HTMLImageElement | null> {
  let data: { success?: boolean; source?: string; tasting_note?: unknown; wine_info?: unknown } | null = null;
  try {
    const res = await fetch(`/api/tasting-notes?item_no=${encodeURIComponent(itemNo)}`, { cache: 'no-store' });
    data = await res.json();
  } catch { return null; }
  if (!data?.success || data.source !== 'db' || !data.tasting_note) return null;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;background:#fff;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(
      <TastingNoteDbCard
        selectedItemNo={itemNo}
        selectedWineName={itemName}
        dbTastingNote={data.tasting_note}
        dbWineInfo={data.wine_info || null}
        originalPdfUrl=""
        onDownload={() => {}}
      />,
    );
    await new Promise((r) => setTimeout(r, 80)); // 렌더 정착 대기
    const dataUrl = await htmlToImage.toPng(host, { pixelRatio: 2, backgroundColor: '#ffffff' });
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('노트카드 이미지 로드 실패'));
      img.src = dataUrl;
    });
    return img;
  } catch {
    return null;
  } finally {
    root.unmount();
    host.remove();
  }
}
