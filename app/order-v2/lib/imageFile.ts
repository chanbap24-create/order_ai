/** File → { base64(데이터부만), mediaType } */
export function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(","); // data:image/png;base64,XXXX
      resolve({
        data: comma >= 0 ? result.slice(comma + 1) : result,
        mediaType: file.type || "image/png",
      });
    };
    reader.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

/** DataTransfer/FileList 에서 이미지 파일만 추출 */
export function imageFilesFrom(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter((f) => f.type.startsWith("image/"));
}
