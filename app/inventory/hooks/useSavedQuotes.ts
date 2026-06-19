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
export function useSavedQuotes(getManagerParam: () => string) {
  const [items, setItems] = useState<SavedQuoteMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mgr = getManagerParam();
      const url =
        `/api/quote/saved?manager=${encodeURIComponent(mgr)}` +
        (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "");
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setItems(data.items || []);
    } catch (e) {
      console.error("저장 견적 목록 조회 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [getManagerParam, search]);

  const remove = useCallback(async (id: number) => {
    try {
      await fetch(`/api/quote/saved?id=${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error("저장 견적 삭제 실패:", e);
    }
  }, []);

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

  const restore = useCallback(
    async (id: number): Promise<{ client_name: string; client_code: string | null; count: number } | null> => {
      try {
        const res = await fetch("/api/quote/saved/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, manager: getManagerParam() }),
        });
        const data = await res.json();
        return data.success ? data : null;
      } catch (e) {
        console.error("저장 견적 복원 실패:", e);
        return null;
      }
    },
    [getManagerParam],
  );

  return { items, loading, search, setSearch, load, remove, getOne, restore };
}
