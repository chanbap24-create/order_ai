// URL/문자열 → 짧은 캐시버스트 토큰(djb2, base36). 원본이 바뀌면 토큰이 달라져
// 프록시 이미지(1h 캐시)의 브라우저 캐시가 자동 무효화된다.
export function cacheVer(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
