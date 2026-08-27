import { useCallback, useState } from "react";

export type SavedQuoteMeta = {
  id: number;
  client_code: string | null;
  client_name: string;
  company: string | null;
  item_count: number;
  total_supply: number;
  created_at: string;
};

/** 저장 견적(이력) 목록/단건/삭제/복원. 담당자 스코프. */
export function useSavedQuotes(
  getManagerParam: () => string,
  /** 복원 대상 바스켓 스코프 (법인별 분리 — 미지정 시 목록과 동일) */
  getRestoreManagerParam: () => string = getManagerParam,
) {
  const [items, setItems] = useState<SavedQuoteMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(""); // 발행일(KST) 필터 — 'YYYY-MM-DD'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mgr = getManagerParam();
      const url =
        `/api/quote/saved?manager=${encodeURIComponent(mgr)}` +
        (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "") +
        (date ? `&date=${date}` : "");
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setItems(data.items || []);
    } catch (e) {
      console.error("저장 견적 목록 조회 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [getManagerParam, search, date]);

  const remove = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/quote/saved?id=${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      setItems((prev) => prev.filter((i) => i.id !== id));
      // 이번 분기 견적 삭제로 '하위거래처 보정 분기 1회' 락이 해제된 경우 안내
      if (j?.stepup_released) alert("이 거래처의 '하위거래처 보정(분기 1회)'이 다시 사용 가능해졌습니다.");
    } catch (e) {
      console.error("저장 견적 삭제 실패:", e);
    }
  }, []);

  /** 선택한 견적 id들 일괄 삭제 — 삭제 건수·보정 락 해제 수 반환 */
  const removeMany = useCallback(async (ids: number[]): Promise<{ deleted: number; stepup_released: number } | null> => {
    if (ids.length === 0) return null;
    try {
      const mgr = getManagerParam();
      const res = await fetch(
        `/api/quote/saved?ids=${ids.join(',')}&manager=${encodeURIComponent(mgr)}`,
        { method: "DELETE" },
      );
      const j = await res.json();
      if (!j?.success) return null;
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      return { deleted: j.deleted || 0, stepup_released: j.stepup_released || 0 };
    } catch (e) {
      console.error("선택 견적 일괄 삭제 실패:", e);
      return null;
    }
  }, [getManagerParam]);

  /** 그 날짜(KST)에 발행된 견적 일괄 삭제 — 삭제 건수·보정 락 해제 수 반환 */
  const removeByDate = useCallback(async (): Promise<{ deleted: number; stepup_released: number } | null> => {
    if (!date) return null;
    try {
      const mgr = getManagerParam();
      const res = await fetch(`/api/quote/saved?date=${date}&manager=${encodeURIComponent(mgr)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j?.success) return null;
      await load();
      return { deleted: j.deleted || 0, stepup_released: j.stepup_released || 0 };
    } catch (e) {
      console.error("날짜별 견적 일괄 삭제 실패:", e);
      return null;
    }
  }, [date, getManagerParam, load]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getOne = useCallback(async (id: number): Promise<any | null> => {
    try {
      const res = await fetch(`/api/quote/saved?id=${id}`);
      const data = await res.json();
      return data.success ? data.item : null;
    } catch {
      return null;
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoteConversion = useCallback(async (id: number): Promise<any | null> => {
    try {
      const res = await fetch(`/api/quote/saved/conversion?id=${id}`);
      const d = await res.json();
      return d.success ? d : null;
    } catch { return null; }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientConversion = useCallback(async (clientCode: string): Promise<any | null> => {
    try {
      const res = await fetch(`/api/quote/saved/conversion?client_code=${encodeURIComponent(clientCode)}`);
      const d = await res.json();
      return d.success ? d : null;
    } catch { return null; }
  }, []);

  const restore = useCallback(
    async (id: number): Promise<{ client_name: string; client_code: string | null; count: number } | null> => {
      try {
        const res = await fetch("/api/quote/saved/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, manager: getRestoreManagerParam() }),
        });
        const data = await res.json();
        return data.success ? data : null;
      } catch (e) {
        console.error("저장 견적 복원 실패:", e);
        return null;
      }
    },
    [getRestoreManagerParam],
  );

  return { items, loading, search, setSearch, date, setDate, load, remove, removeMany, removeByDate, getOne, restore, quoteConversion, clientConversion };
}
