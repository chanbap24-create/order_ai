"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  alias: string;
  canonical: string;
  client_code?: string;
  count?: number;
  last_used_at?: string;
  created_at?: string;
};

export default function LearnedAliasList({
  version,
  onChanged,
}: {
  version: number;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch("/api/list-item-alias", { cache: "no-store" });
      const json = await res.json();

      // ✅ 중요: 서버 응답이 { success, rows } 형태
      setRows(Array.isArray(json?.rows) ? json.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // version이 바뀌면 강제 리프레시
  }, [version]);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return rows;
    return rows.filter(
      (r) => r.alias.includes(t) || r.canonical.includes(t)
    );
  }, [rows, q]);

  async function del(alias: string, clientCode?: string) {
    const clientDisplay = clientCode && clientCode !== '*' ? ` (거래처: ${clientCode})` : '';
    if (!confirm(`삭제할까?\n${alias}${clientDisplay}`)) return;

    const res = await fetch("/api/delete-item-alias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        alias, 
        client_code: clientCode || '*'  // ✅ client_code 전달
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      alert(`삭제 실패: ${json?.error ?? ""}`);
      return;
    }

    await fetchRows();
    onChanged?.();
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={fetchRows}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            cursor: "pointer",
          }}
        >
          {loading ? "새로고침..." : "새로고침"}
        </button>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="검색 (alias / canonical)"
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        {filtered.length}건
      </div>

      {filtered.length === 0 ? (
        <div style={{ marginTop: 12, padding: 12, background: "#fafafa", borderRadius: 10 }}>
          학습된 항목이 없습니다.
        </div>
      ) : (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((r) => (
            <div
              key={`${r.alias}__${r.client_code || '*'}`}  // ✅ 복합 키로 고유성 보장
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                padding: 10,
                border: "1px solid #eee",
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  {r.alias} → {r.canonical}
                  {r.client_code && r.client_code !== '*' && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#666', padding: '2px 6px', background: '#f0f0f0', borderRadius: 4 }}>
                      거래처: {r.client_code}
                    </span>
                  )}
                  {r.count && r.count > 1 && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#FF6B35", fontWeight: 600 }}>
                      (학습 {r.count}회)
                    </span>
                  )}
                </div>
                {(r.last_used_at || r.created_at) && (
                  <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
                    {r.last_used_at ? `최근 사용: ${r.last_used_at}` : `생성: ${r.created_at}`}
                  </div>
                )}
              </div>

              <button
                onClick={() => del(r.alias, r.client_code)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  height: 36,
                }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
