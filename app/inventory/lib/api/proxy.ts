/** 외부 PDF URL을 프록시 경로로 감싸서 반환 (CORS 우회) */
export function pdfProxyUrl(externalUrl: string): string {
  return `/api/proxy/pdf?url=${encodeURIComponent(externalUrl)}`;
}
