"use client";

import { useEffect, useMemo, useState } from "react";
import LearnedAliasList from "@/app/components/LearnedAliasList";

type LearnRow = { alias: string; canonical: string };

export default function Home() {
  const [text, setText] = useState("");
  const [force, setForce] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ✅ 거래처 선택(동점/애매) UI용
  const [clientCandidates, setClientCandidates] = useState<any[] | null>(null);
  const [pendingOrderText, setPendingOrderText] = useState<string>("");
  const [pendingPreMessage, setPendingPreMessage] = useState<string>("");

  // ✅ 학습 입력 5개
  const [learnInputs, setLearnInputs] = useState<LearnRow[]>(
    Array.from({ length: 5 }, () => ({ alias: "", canonical: "" }))
  );

  // ✅ 학습된 목록 토글 + 강제 갱신 버전
  const [showLearned, setShowLearned] = useState(false);
  const [learnedVersion, setLearnedVersion] = useState(0);

  // ✅ 복사 상태(버튼 텍스트)
  const [copied, setCopied] = useState(false);

  // ✅ 전체 JSON 토글
  const [showJson, setShowJson] = useState(false);

  // ✅ 후보 선택 학습 저장 상태 (itemIndex별)
  const [savingPick, setSavingPick] = useState<Record<number, boolean>>({});
  const [savedPick, setSavedPick] = useState<Record<number, boolean>>({});

  // ✅ 품목 결과/학습 입력 접기
  const [showItemsPanel, setShowItemsPanel] = useState(false);
  const [showLearnInput, setShowLearnInput] = useState(false);

  const canSave = useMemo(
    () => learnInputs.some((r) => r.alias.trim() && r.canonical.trim()),
    [learnInputs]
  );

  // ✅ status에 따라 품목 결과 자동 오픈/클로즈
  useEffect(() => {
    const st = data?.status;
    if (!st) return;

    if (st === "needs_review_items") {
      setShowItemsPanel(true); // ✅ 자동확정 안 되면 자동으로 열기
      return;
    }

    if (st === "needs_review_client") {
      setShowItemsPanel(false); // 거래처 선택 단계에서는 닫기
      return;
    }

    if (st === "resolved") {
      setShowItemsPanel(false); // 모두 확정되면 자동으로 닫기
      return;
    }
  }, [data?.status]);

  async function callParse(payload: any) {
    const res = await fetch("/api/parse-full-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    return { res, json };
  }

  async function run() {
    setLoading(true);
    setData(null);
    setShowJson(false); // ✅ 새 실행 시 JSON은 기본 닫힘(렌더 부담 감소)

    // 거래처 선택 상태 초기화
    setClientCandidates(null);
    setPendingOrderText("");
    setPendingPreMessage("");

    try {
      const { json } = await callParse({ message: text, force_resolve: force });
      setData(json);

      // 새 결과 나오면 pick 상태는 초기화 (새 주문이니까)
      setSavingPick({});
      setSavedPick({});
      setCopied(false);

      // ✅ 거래처 선택 필요
      if (json?.status === "needs_review_client") {
        const cands = Array.isArray(json?.client?.candidates)
          ? json.client.candidates
          : [];

        setClientCandidates(cands);

        // 서버가 내려준 debug(네 응답 구조 그대로 활용)
        setPendingOrderText(String(json?.debug?.orderText ?? ""));
        setPendingPreMessage(String(json?.debug?.preprocessed_message ?? text));

        // 거래처 선택 단계에서는 학습 패널 닫기
        setShowLearnInput(false);
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ 거래처 후보 클릭 → 선택한 거래처로 재파싱
  async function pickClient(c: any) {
    const clientName = String(c?.client_name ?? "").trim();
    if (!clientName) return;

    setLoading(true);
    try {
      const { json } = await callParse({
        message: pendingPreMessage || text,
        clientText: clientName, // ✅ 핵심: alias 그대로 보내면 exact(norm)로 resolved 가능
        orderText: pendingOrderText || "",
        force_resolve: force,
      });

      setData(json);

      // 거래처 선택 UI는 닫기
      setClientCandidates(null);
      setPendingOrderText("");
      setPendingPreMessage("");

      // 새 결과니까 pick 상태 초기화
      setSavingPick({});
      setSavedPick({});
      setCopied(false);
    } finally {
      setLoading(false);
    }
  }

  // ✅ 입력/결과 전체 초기화 버튼
  function clearAll() {
    setText("");
    setData(null);
    setCopied(false);
    setShowJson(false);
    setSavingPick({});
    setSavedPick({});
    setLoading(false);

    setClientCandidates(null);
    setPendingOrderText("");
    setPendingPreMessage("");

    setShowItemsPanel(false);
    setShowLearnInput(false);
  }

  function updateLearn(i: number, key: keyof LearnRow, value: string) {
    setLearnInputs((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  }

  function resetLearnInputs() {
    setLearnInputs(Array.from({ length: 5 }, () => ({ alias: "", canonical: "" })));
  }

  async function saveLearnInputs() {
    const rows = learnInputs
      .map((r) => ({ alias: r.alias.trim(), canonical: r.canonical.trim() }))
      .filter((r) => r.alias && r.canonical);

    if (rows.length === 0) {
      alert("자연어/정답을 1개 이상 입력하세요.");
      return;
    }

    // 단건 API라서 5개까지 순차 저장
    for (const r of rows) {
      const res = await fetch("/api/learn-item-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      });

      const json = await res.json().catch(() => null);
      if (
        !res.ok ||
        json?.success === false ||
        (typeof json?.saved === "number" && json.saved < 1)
      ) {
        alert(`학습 저장 실패: ${r.alias}\n${json?.error ?? ""}`);
        return;
      }
    }

    resetLearnInputs();
    setLearnedVersion((v) => v + 1); // ✅ 목록 새로고침 트리거
    setShowLearned(true);
    alert("학습 저장 완료");
  }

  async function copyStaffMessage() {
    const msg = String(data?.staff_message ?? "");
    if (!msg) {
      alert("복사할 내용이 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  }

  // ✅ 선택 즉시 화면 반영(직원메시지 + items)
  function applySuggestionToResult(itemIndex: number, s: any) {
    setData((prev: any) => {
      if (!prev) return prev;

      const next = { ...prev };
      const items = Array.isArray(next.items) ? [...next.items] : [];
      const target = items[itemIndex];
      if (!target) return prev;

      const qty = target.qty;

      // 1) items 확정 처리(override 가능)
      items[itemIndex] = {
        ...target,
        resolved: true,
        item_no: s.item_no,
        item_name: s.item_name,
        score: typeof s.score === "number" ? s.score : target.score,
      };
      next.items = items;

      // 2) 직원메시지 라인 치환
      const staff = String(next.staff_message ?? "");
      const oldLineUnresolved = `- 확인필요 / "${target.name}" / ${qty}병`;
      const oldLineResolved = target?.item_no
        ? `- ${target.item_no} / ${target.item_name} / ${qty}병`
        : "";

      const newLine = `- ${s.item_no} / ${s.item_name} / ${qty}병`;

      if (staff.includes(oldLineUnresolved)) {
        next.staff_message = staff.replace(oldLineUnresolved, newLine);
      } else if (oldLineResolved && staff.includes(oldLineResolved)) {
        next.staff_message = staff.replace(oldLineResolved, newLine);
      } else {
        // fallback
        next.staff_message = staff
          .split("\n")
          .map((line) => {
            const hasQty = line.includes(`${qty}병`);
            if (!hasQty) return line;

            const hitUnresolved =
              line.includes("확인필요") && line.includes(String(target.name ?? ""));
            const hitResolved =
              target?.item_no && line.includes(String(target.item_no));

            if (hitUnresolved || hitResolved) return newLine;
            return line;
          })
          .join("\n");
      }

      // 3) status 업데이트(전부 확정되면 resolved)
      const hasUnresolved = items.some((x: any) => !x?.resolved);
      next.status = hasUnresolved ? "needs_review_items" : "resolved";

      return next;
    });
  }

  // ✅ 선택 결과를 학습 테이블에 저장
  async function learnSelectedAlias(itemIndex: number, s: any) {
    const it = (Array.isArray(data?.items) ? data.items : [])[itemIndex];
    const alias = String(it?.name || it?.raw || "").trim();
    const canonical = String(s?.item_no || "").trim(); // ✅ 품목코드로 저장

    if (!alias || !canonical) {
      alert("학습에 필요한 값이 비어있습니다.");
      return false;
    }

    setSavingPick((p) => ({ ...p, [itemIndex]: true }));
    setSavedPick((p) => ({ ...p, [itemIndex]: false }));

    try {
      const res = await fetch("/api/learn-item-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, canonical }),
      });

      const json = await res.json().catch(() => null);

      if (
        !res.ok ||
        json?.success === false ||
        (typeof json?.saved === "number" && json.saved < 1)
      ) {
        alert(`학습 저장 실패:\n${alias} → ${canonical}\n${json?.error ?? ""}`);
        return false;
      }

      // ✅ 학습 목록 갱신 + 열기
      setLearnedVersion((v) => v + 1);
      setShowLearned(true);
      setSavedPick((p) => ({ ...p, [itemIndex]: true }));
      return true;
    } finally {
      setSavingPick((p) => ({ ...p, [itemIndex]: false }));
    }
  }

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 10,
    background: "#fff",
  };
  const monoStyle: React.CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
  };

  // ✅ 후보는 최대 3개만 보여주기
  function getTop3Suggestions(it: any) {
    const arr = Array.isArray(it?.suggestions)
      ? it.suggestions
      : Array.isArray(it?.candidates)
        ? it.candidates
        : [];
    return arr.slice(0, 3);
  }

  const needsClientPick = data?.status === "needs_review_client";

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "system-ui",
      }}
    >
      {/* ===== Header ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>발주 메시지 생성</div>
      </div>

      {/* ===== Controls ===== */}
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
          onClick={run}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "#f5f5f5" : "#fff",
          }}
        >
          {loading ? "생성중..." : "생성"}
        </button>

        {/* ✅ 지우기 */}
        <button
          onClick={clearAll}
          disabled={loading || (!text.trim() && !data)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: loading || (!text.trim() && !data) ? "not-allowed" : "pointer",
            background: loading || (!text.trim() && !data) ? "#f5f5f5" : "#fff",
          }}
          title="입력된 내용을 지우고 결과를 초기화합니다"
        >
          🧹 지우기
        </button>
      </div>

      {/* ===== Input ===== */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ddd",
          ...monoStyle,
        }}
      />

      {/* =========================
          ✅ 거래처 선택 패널
      ========================= */}
      {data && needsClientPick && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            거래처 선택이 필요합니다
          </div>

          <div style={{ ...cardStyle, background: "#fff" }}>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
              입력된 거래처가 여러 후보로 동점/애매하게 매칭되어 자동확정이 보류되었습니다. 아래에서 선택하세요.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(clientCandidates ?? []).map((c, idx) => (
                <button
                  key={`${c.client_code}-${idx}`}
                  onClick={() => pickClient(c)}
                  disabled={loading}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    cursor: loading ? "not-allowed" : "pointer",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{c.client_name}</div>
                  <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                    코드: {c.client_code} · 점수: {c.score}
                  </div>
                </button>
              ))}

              {(clientCandidates ?? []).length === 0 && (
                <div style={{ color: "#888", fontSize: 12 }}>
                  후보가 비어 있습니다. (client.candidates가 내려오지 않는 케이스)
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#888" }}>
              힌트: <b>{String(data?.client?.hint_used ?? "")}</b>
              {pendingOrderText ? (
                <>
                  <br />
                  주문 라인: <span style={monoStyle}>{pendingOrderText}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* =========================
          ✅ 거래처 선택이 아닌 경우에만 기존 출력 표시
      ========================= */}
      {data && !needsClientPick && (
        <div style={{ marginTop: 18 }}>
          {/* ---- Staff Message ---- */}
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>직원 메시지</div>

              <button
                onClick={copyStaffMessage}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background: copied ? "#e8fff1" : "#fff",
                }}
              >
                {copied ? "복사됨 ✅" : "복사하기"}
              </button>
            </div>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #eee",
                background: "#fafafa",
                marginTop: 10,
                ...monoStyle,
              }}
            >
              {String(data.staff_message ?? "")}
            </pre>
          </div>

          {/* ---- Summary ---- */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
              요약
            </div>
            <div style={cardStyle}>
              <div style={{ marginBottom: 8 }}>
                거래처: <b>{String(data?.client?.client_name ?? "")}</b> (
                {String(data?.client?.client_code ?? "")})
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(Array.isArray(data?.parsed_items) ? data.parsed_items : []).map(
                  (p: any, idx: number) => (
                    <div key={idx} style={{ ...monoStyle }}>
                      {String(p?.raw ?? "")}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ---- Items (toggle) ---- */}
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>품목 결과</div>

              <button
                onClick={() => setShowItemsPanel((v) => !v)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background: "#fff",
                  fontSize: 13,
                }}
              >
                {showItemsPanel ? "🔽 품목 결과 닫기" : "🔼 품목 결과 열기"}
              </button>
            </div>

            {showItemsPanel && (
              <div style={{ ...cardStyle, background: "#fff" }}>
                {(Array.isArray(data?.items) ? data.items : []).map(
                  (it: any, idx: number) => {
                    const line = it?.resolved
                      ? `${it.item_no} / ${it.item_name} / ${it.qty}병`
                      : `확인필요 / "${it.name}" / ${it.qty}병`;

                    const top3 = getTop3Suggestions(it);

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 0",
                          borderBottom:
                            idx === data.items.length - 1
                              ? "none"
                              : "1px solid #f2f2f2",
                          display: "flex",
                          gap: 10,
                          flexDirection: "column",
                        }}
                      >
                        <div style={{ display: "flex", gap: 10 }}>
                          <div
                            style={{
                              width: 80,
                              color: it?.resolved ? "#0a7" : "#b00",
                              fontWeight: 700,
                            }}
                          >
                            {it?.resolved ? "확정" : "확인"}
                          </div>
                          <div style={{ flex: 1, ...monoStyle }}>{line}</div>
                          <div
                            style={{
                              width: 70,
                              textAlign: "right",
                              color: "#777",
                              fontVariantNumeric: "tabular-nums" as any,
                            }}
                          >
                            {typeof it?.score === "number"
                              ? it.score.toFixed(3)
                              : ""}
                          </div>
                        </div>

                        {/* 후보 3개 선택 버튼 */}
                        {top3.length > 0 && (
                          <div
                            style={{
                              marginLeft: 80,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#666" }}>
                              👉 아래 후보 중 하나를 선택하면 결과/직원메시지가 즉시
                              반영됩니다
                            </div>

                            {top3.map((s: any, sidx: number) => {
                              const saving = !!savingPick[idx];
                              const saved = !!savedPick[idx];

                              return (
                                <button
                                  key={sidx}
                                  disabled={saving}
                                  style={{
                                    textAlign: "left",
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    border: "1px solid #ddd",
                                    background: saving
                                      ? "#f5f5f5"
                                      : saved
                                        ? "#e8fff1"
                                        : "#fafafa",
                                    cursor: saving
                                      ? "not-allowed"
                                      : "pointer",
                                    fontSize: 13,
                                    opacity: saving ? 0.7 : 1,
                                  }}
                                  onClick={async () => {
                                    applySuggestionToResult(idx, s);
                                    await learnSelectedAlias(idx, s);
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 10,
                                    }}
                                  >
                                    <div
                                      style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <b>{s.item_no}</b> / {s.item_name}
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        flexShrink: 0,
                                        fontVariantNumeric:
                                          "tabular-nums" as any,
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: saved ? "#0a7" : "#999",
                                        }}
                                      >
                                        {saving
                                          ? "저장중..."
                                          : saved
                                            ? "저장됨 ✅"
                                            : ""}
                                      </span>
                                      <span style={{ color: "#888" }}>
                                        {Number(s.score || 0).toFixed(3)}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {top3.length === 0 && (
                          <div
                            style={{
                              marginLeft: 80,
                              fontSize: 12,
                              color: "#888",
                            }}
                          >
                            후보가 없습니다.
                          </div>
                        )}
                      </div>
                    );
                  }
                )}

                {!Array.isArray(data?.items) || data.items.length === 0 ? (
                  <div style={{ color: "#888" }}>품목 결과가 없습니다.</div>
                ) : null}
              </div>
            )}
          </div>

          {/* ---- Learn Input (toggle) ---- */}
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>품목 학습</div>

              <button
                onClick={() => setShowLearnInput((v) => !v)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background: "#fff",
                  fontSize: 13,
                }}
              >
                {showLearnInput ? "🔽 학습 입력 닫기" : "🔼 학습 입력 열기"}
              </button>
            </div>

            {showLearnInput && (
              <>
                <div style={{ color: "#777", fontSize: 12, marginTop: 4 }}>
                  자연어 → 정답(표준 키워드/약어/정확한 품목명) 저장. 저장 즉시
                  resolve에 반영.
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {learnInputs.map((row, i) => (
                    <div key={i} style={{ display: "flex", gap: 8 }}>
                      <input
                        value={row.alias}
                        onChange={(e) =>
                          updateLearn(i, "alias", e.target.value)
                        }
                        placeholder='자연어 (예: "뵈브 암발", "샤를루")'
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #ddd",
                        }}
                      />
                      <input
                        value={row.canonical}
                        onChange={(e) =>
                          updateLearn(i, "canonical", e.target.value)
                        }
                        placeholder='정답 (예: "VA", "VA 샤를루 블랑 드 블랑 브륏")'
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #ddd",
                        }}
                      />
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button
                      onClick={saveLearnInputs}
                      disabled={!canSave}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        cursor: canSave ? "pointer" : "not-allowed",
                        opacity: canSave ? 1 : 0.5,
                        background: "#fff",
                      }}
                    >
                      학습 저장
                    </button>

                    <button
                      onClick={resetLearnInputs}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        cursor: "pointer",
                        background: "#fff",
                      }}
                    >
                      입력 초기화
                    </button>

                    <div
                      style={{
                        marginLeft: "auto",
                        color: "#888",
                        fontSize: 12,
                        alignSelf: "center",
                      }}
                    >
                      저장 후 목록 자동 갱신됨
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ---- Full JSON (toggle) ---- */}
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>JSON</div>

              <button
                onClick={() => setShowJson((v) => !v)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background: "#fff",
                  fontSize: 13,
                }}
              >
                {showJson ? "🔽 JSON 닫기" : "🔼 JSON 보기"}
              </button>
            </div>

            {showJson && (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #eee",
                  background: "#0b1020",
                  color: "#e6e6e6",
                  overflowX: "auto",
                  ...monoStyle,
                }}
              >
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* =========================
          학습목록 (UI 통일)
      ========================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
        }}
      >
        <div style={{ fontWeight: 700 }}>학습목록</div>

        <button
          onClick={() => setShowLearned((v) => !v)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {showLearned ? "학습 결과 닫기" : "학습 결과 보기"}
        </button>
      </div>

      {showLearned && (
        <div style={{ marginTop: 10 }}>
          <LearnedAliasList
            version={learnedVersion}
            onChanged={() => setLearnedVersion((v) => v + 1)}
          />
        </div>
      )}
    </div>
  );
}
