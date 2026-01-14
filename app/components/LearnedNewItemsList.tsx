"use client";

import { useEffect, useState } from "react";

type NewItemRow = {
  client_code: string;
  client_name: string;
  item_no: string;
  item_name: string;
  supply_price: number | null;
  updated_at: string;
};

export default function LearnedNewItemsList({ version }: { version: number }) {
  const [rows, setRows] = useState<NewItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch("/api/list-new-items", { cache: "no-store" });
      const json = await res.json();
      setRows(Array.isArray(json?.rows) ? json.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, [version]);

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          신규 품목 학습 내역
        </h3>
        <button
          onClick={fetchRows}
          disabled={loading}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            cursor: "pointer",
            fontSize: 13,
            marginLeft: "auto",
          }}
        >
          {loading ? "새로고침..." : "새로고침"}
        </button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
        {rows.length}건
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
          신규 품목 학습 내역이 없습니다
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>거래처</th>
                <th style={{ padding: 8 }}>품목번호</th>
                <th style={{ padding: 8 }}>품목명</th>
                <th style={{ padding: 8 }}>공급가</th>
                <th style={{ padding: 8 }}>등록일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: 8 }}>
                    {row.client_name || row.client_code}
                  </td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>
                    {row.item_no}
                  </td>
                  <td style={{ padding: 8 }}>{row.item_name}</td>
                  <td style={{ padding: 8 }}>
                    {row.supply_price 
                      ? `${row.supply_price.toLocaleString()}원` 
                      : '-'}
                  </td>
                  <td style={{ padding: 8, fontSize: 11, color: "#999" }}>
                    {new Date(row.updated_at).toLocaleString('ko-KR', {
                      year: '2-digit',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
