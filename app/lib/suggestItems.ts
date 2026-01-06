// app/lib/suggestItems.ts
import { db } from "@/app/lib/db";

function norm(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

function scoreName(q: string, name: string) {
  const a = norm(q);
  const b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.92;

  // 간단 문자 교집합 점수(가벼운 스코어)
  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  const s = common / Math.max(6, a.length);
  return Math.max(0, Math.min(0.91, s));
}

type ItemRow = { item_no: string; item_name: string };

function tryGetAllItems(): ItemRow[] {
  // ✅ 프로젝트마다 테이블/컬럼명이 다를 수 있어서, 가장 흔한 조합을 순차 시도
  const tries: Array<{ sql: string; map: (r: any) => ItemRow }> = [
    {
      sql: `SELECT item_no, item_name FROM items`,
      map: (r) => ({ item_no: String(r.item_no), item_name: String(r.item_name) }),
    },
    {
      sql: `SELECT item_no, name as item_name FROM items`,
      map: (r) => ({ item_no: String(r.item_no), item_name: String(r.item_name) }),
    },
    {
      sql: `SELECT item_code as item_no, item_name FROM items`,
      map: (r) => ({ item_no: String(r.item_no), item_name: String(r.item_name) }),
    },
    {
      sql: `SELECT item_code as item_no, name as item_name FROM items`,
      map: (r) => ({ item_no: String(r.item_no), item_name: String(r.item_name) }),
    },
  ];

  for (const t of tries) {
    try {
      const rows = db.prepare(t.sql).all() as any[];
      if (rows?.length) return rows.map(t.map);
    } catch {}
  }
  return [];
}

export type ItemSuggestion = {
  item_no: string;
  item_name: string;
  score: number; // 0~1
};

export function suggestTop3Items(query: string): ItemSuggestion[] {
  const q = String(query || "").trim();
  if (!q) return [];

  const items = tryGetAllItems();
  if (!items.length) return [];

  return items
    .map((it) => ({
      item_no: it.item_no,
      item_name: it.item_name,
      score: scoreName(q, it.item_name),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
