/** 현재 로그인한 매니저(계정 이름) 조회. 실패 시 빈 문자열 반환. */
export async function fetchCurrentManager(): Promise<string> {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    return json?.user?.name || json?.user?.email || "";
  } catch {
    return "";
  }
}
