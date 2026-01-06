"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GlassOrder() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [force, setForce] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) {
      alert("발주 내용을 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      // TODO: 와인잔 전용 API 엔드포인트 추가 필요
      const response = await fetch("/api/parse-glass-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          force_resolve: force,
        }),
      });

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setText("");
    setData(null);
  };

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          ← 뒤로
        </button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🥂 와인잔 발주 메시지 생성</div>
        <div style={{ color: "#777", fontSize: 13 }}>대유라이프 와인잔 전용</div>
      </div>

      {/* 컨트롤 */}
      <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          자동확정(force_resolve)
        </label>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "#f5f5f5" : "#fff",
          }}
        >
          {loading ? "처리중..." : "생성"}
        </button>
        <button
          onClick={handleClear}
          disabled={!text && !data}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: !text && !data ? "not-allowed" : "pointer",
            background: !text && !data ? "#f5f5f5" : "#fff",
          }}
          title="입력된 내용을 지우고 결과를 초기화합니다"
        >
          🧹 지우기
        </button>
        <div style={{ marginLeft: "auto", color: "#888", fontSize: 12 }}>
          팁: 거래처명과 품목을 입력하세요
        </div>
      </div>

      {/* 입력 영역 */}
      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`거래처명\n품목1 수량1\n품목2 수량2\n...`}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ddd",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
        }}
      />

      {/* 결과 영역 */}
      {data && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 10 }}>결과</h3>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 16,
              borderRadius: 12,
              overflow: "auto",
              fontSize: 13,
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}

      {/* 안내 메시지 */}
      <div
        style={{
          marginTop: 40,
          padding: 20,
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: 12,
          color: "#856404",
        }}
      >
        <h4 style={{ margin: 0, marginBottom: 8, fontWeight: 700 }}>
          🚧 개발 중
        </h4>
        <p style={{ margin: 0 }}>
          와인잔 발주 기능은 현재 개발 중입니다. API 엔드포인트와 데이터베이스 설정이 필요합니다.
        </p>
      </div>
    </div>
  );
}
