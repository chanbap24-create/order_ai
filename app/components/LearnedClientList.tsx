"use client";

import { useEffect, useState } from "react";

type LearnedClient = {
  client_code: string;
  alias: string;
  weight: number;
  client_name: string;
};

export default function LearnedClientList({
  type,
  version,
}: {
  type: "wine" | "glass";
  version: number;
}) {
  const [items, setItems] = useState<LearnedClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string>("");

  useEffect(() => {
    loadItems();
  }, [type, version]);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/learn-client?type=${type}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.items || []);
      }
    } catch (error) {
      console.error("학습된 거래처 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(item: LearnedClient) {
    if (!confirm(`"${item.alias}" → "${item.client_name}" 학습을 삭제하시겠습니까?`)) {
      return;
    }

    const key = `${item.client_code}_${item.alias}`;
    setDeleting(key);
    try {
      const res = await fetch("/api/learn-client", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_code: item.client_code,
          alias: item.alias,
          type,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // 목록에서 제거
        setItems((prev) => prev.filter((x) => x.alias !== item.alias || x.client_code !== item.client_code));
        alert("삭제되었습니다!");
      } else {
        alert("삭제 실패: " + json.message);
      }
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제 실패!");
    } finally {
      setDeleting("");
    }
  }

  if (loading) {
    return <div style={{ padding: 20, textAlign: "center", color: "#666" }}>로딩 중...</div>;
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#999", fontSize: 14 }}>
        학습된 거래처가 없습니다.
        <br />
        <span style={{ fontSize: 12 }}>
          거래처 선택 후 자동으로 학습됩니다.
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8, paddingLeft: 12 }}>
        총 {items.length}개의 학습된 거래처
      </div>
      {items.map((item, idx) => {
        const key = `${item.client_code}_${item.alias}`;
        const isDeleting = deleting === key;
        
        return (
          <div
            key={key}
            style={{
              padding: "10px 12px",
              borderBottom: idx < items.length - 1 ? "1px solid #f0f0f0" : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                {item.alias}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                → {item.client_name} ({item.client_code})
              </div>
            </div>
            <button
              onClick={() => deleteItem(item)}
              disabled={isDeleting}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #ff4444",
                background: "#fff",
                color: "#ff4444",
                cursor: isDeleting ? "not-allowed" : "pointer",
                opacity: isDeleting ? 0.5 : 1,
              }}
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
