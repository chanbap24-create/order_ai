// app/lib/shareFile.ts (클라이언트 유틸)
// 모바일: OS 공유 시트로 '파일만' 공유 (url·text 미포함 — 카톡에 링크가 딸려가지 않음).
// 데스크탑/미지원: 일반 브라우저 다운로드 폴백.
//
// 배경: 블롭 다운로드 후 사파리 PDF 뷰어·파일앱에서 공유하면 iOS가 출처 URL을
// 함께 붙여 카톡에 "파일+링크"로 전송되던 문제. 앱 안에서 파일 단독 공유로 해결.

export async function shareOrDownloadFile(
  blob: Blob,
  filename: string,
  mime = 'application/octet-stream',
): Promise<void> {
  // 모바일 + Web Share API(파일) 지원 시: 파일만 공유
  try {
    const file = new File([blob], filename, { type: mime });
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }); // title/url/text 절대 넣지 않음 — 파일만 전송
      return;
    }
  } catch (e) {
    // 사용자가 공유 시트를 닫은 경우: 다운로드 폴백도 하지 않음(의도적 취소)
    if ((e as Error)?.name === 'AbortError') return;
    // 그 외(미지원 등)는 다운로드 폴백으로
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
