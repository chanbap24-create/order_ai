"use client";

import { useEffect, useMemo, useState } from "react";
import LearnedAliasList from "@/app/components/LearnedAliasList";
import LearnedClientList from "@/app/components/LearnedClientList";

type LearnRow = { alias: string; canonical: string };

export default function Home() {
  const [text, setText] = useState("");
  const [clientInput, setClientInput] = useState(""); // ✅ 거래처 입력칸
  const [force, setForce] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ✅ 탭 상태
  const [activeTab, setActiveTab] = useState<"order" | "learning">("order");

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
  
  // ✅ 신규 품목 가격 입력 (itemIndex별)
  const [newItemPrices, setNewItemPrices] = useState<Record<number, string>>({});

  // ✅ 품목 결과/학습 입력 접기
  const [showItemsPanel, setShowItemsPanel] = useState(false);
  const [showLearnInput, setShowLearnInput] = useState(false);

  // ✅ 거래처 품목 보기
  const [showClientItems, setShowClientItems] = useState(false);
  const [clientItems, setClientItems] = useState<any[]>([]);
  const [loadingClientItems, setLoadingClientItems] = useState(false);

  // ✅ 학습된 거래처 목록
  const [showLearnedClients, setShowLearnedClients] = useState(false);
  const [learnedClientVersion, setLearnedClientVersion] = useState(0);

  // ✅ 발주 옵션
  const [customDeliveryDate, setCustomDeliveryDate] = useState("");
  const [requirePaymentConfirm, setRequirePaymentConfirm] = useState(false);
  const [requireInvoice, setRequireInvoice] = useState(false);
  const [showOrderOptions, setShowOrderOptions] = useState(false); // ✅ 발주 옵션 접기/펼치기

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
      // ✅ 거래처칸이 비어있으면 첫줄을 거래처로, 있으면 거래처칸 + 발주내용 합침
      const finalMessage = clientInput.trim() 
        ? `${clientInput.trim()}\n${text}` 
        : text;

      const { json } = await callParse({
        message: finalMessage,
        force_resolve: force,
        customDeliveryDate: customDeliveryDate || undefined,
        requirePaymentConfirm: requirePaymentConfirm || undefined,
        requireInvoice: requireInvoice || undefined,
      });
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

  // ✅ 거래처 품목 로드
  async function loadClientItems() {
    const clientCode = data?.client?.client_code;
    if (!clientCode) return;

    setLoadingClientItems(true);
    try {
      const res = await fetch("/api/client-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_code: clientCode, type: "wine" }),
      });
      const json = await res.json();
      
      if (json.success) {
        setClientItems(json.items || []);
        setShowClientItems(true);
      }
    } catch (error) {
      console.error("Failed to load client items:", error);
    } finally {
      setLoadingClientItems(false);
    }
  }

  // ✅ 품목 직접 추가
  function addItemManually(item: any) {
    const qty = prompt(`${item.item_name}\n\n수량을 입력하세요:`, "1");
    if (!qty || isNaN(Number(qty))) return;

    const newText = text + `\n${item.item_name} ${qty}`;
    setText(newText);
    alert(`추가되었습니다!\n\n${item.item_name} ${qty}개`);
  }

  // ✅ 거래처 후보 클릭 → 선택한 거래처로 재파싱
  async function pickClient(c: any) {
    const clientName = String(c?.client_name ?? "").trim();
    const clientCode = String(c?.client_code ?? "").trim();
    if (!clientName || !clientCode) return;

    setLoading(true);
    try {
      // ✅ 1. 거래처 학습 (입력된 텍스트의 첫 줄을 alias로 학습)
      const firstLineText = (pendingPreMessage || text).split("\n")[0].trim();
      if (firstLineText && firstLineText !== clientName) {
        try {
          await fetch("/api/learn-client", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_code: clientCode,
              alias: firstLineText,
              type: "wine",
            }),
          });
          console.log("✅ 거래처 학습:", firstLineText, "→", clientName);
          // ✅ 학습 후 목록 갱신
          setLearnedClientVersion((v) => v + 1);
        } catch (err) {
          console.error("거래처 학습 실패:", err);
        }
      }

      // ✅ 2. 재파싱
      const { json } = await callParse({
        message: pendingPreMessage || text,
        clientText: clientName, // ✅ 핵심: alias 그대로 보내면 exact(norm)로 resolved 가능
        orderText: pendingOrderText || "",
        force_resolve: force,
        customDeliveryDate: customDeliveryDate || undefined,
        requirePaymentConfirm: requirePaymentConfirm || undefined,
        requireInvoice: requireInvoice || undefined,
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
    let msg = String(data?.staff_message ?? "");
    if (!msg) {
      alert("복사할 내용이 없습니다.");
      return;
    }

    // ✅ 배송일 커스터마이징
    if (customDeliveryDate.trim()) {
      // 기존 배송일 라인 찾아서 교체
      msg = msg.replace(/배송 예정일: .+/g, `배송 예정일: ${customDeliveryDate.trim()}`);
    }

    // ✅ 추가 문구 삽입 (발주 요청드립니다 앞에)
    const additionalLines: string[] = [];
    if (requirePaymentConfirm) {
      additionalLines.push("입금확인후 출고.");
    }
    if (requireInvoice) {
      additionalLines.push("거래명세표 부탁드립니다.");
    }

    if (additionalLines.length > 0) {
      // "발주 요청드립니다" 또는 줄 끝에 추가
      if (msg.includes("발주 요청드립니다")) {
        msg = msg.replace(
          /발주 요청드립니다\.?/g,
          additionalLines.join("\n") + "\n\n발주 요청드립니다."
        );
      } else {
        // 발주 요청드립니다가 없으면 맨 끝에 추가
        msg = msg.trim() + "\n\n" + additionalLines.join("\n") + "\n\n발주 요청드립니다.";
      }
    }

    try {
      await navigator.clipboard.writeText(msg);
      alert("복사 완료!\n\n" + msg);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("복사 완료!\n\n" + msg);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  }

  // ✅ 선택 즉시 화면 반영(직원메시지 + items)
  function applySuggestionToResult(itemIndex: number, s: any, supplyPrice?: string) {
    setData((prev: any) => {
      if (!prev) return prev;

      const next = { ...prev };
      const items = Array.isArray(next.items) ? [...next.items] : [];
      const target = items[itemIndex];
      if (!target) return prev;

      const qty = target.qty;
      const isNewItem = !!target.is_new_item;

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
      
      // 한글명만 추출 (/ 앞부분)
      const koreanName = s.item_name?.split(' / ')[0] || s.item_name;
      
      const oldLineUnresolved = `- 확인필요 / "${target.name}" / ${qty}병`;
      const oldLineResolved = target?.item_no
        ? `- ${target.item_no} / ${target.item_name} / ${qty}병`
        : "";

      // 신규 품목일 때 가격 포함
      const newLine = isNewItem && supplyPrice
        ? `- ${s.item_no} / ${koreanName} / ${qty}병 / ${parseInt(supplyPrice, 10).toLocaleString()}원`
        : `- ${s.item_no} / ${koreanName} / ${qty}병`;

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
  async function learnSelectedAlias(itemIndex: number, s: any, supplyPrice?: string) {
    const it = (Array.isArray(data?.items) ? data.items : [])[itemIndex];
    const alias = String(it?.name || it?.raw || "").trim();
    const canonical = String(s?.item_no || "").trim(); // ✅ 품목코드로 저장
    const isNewItem = !!it?.is_new_item;

    if (!alias || !canonical) {
      alert("학습에 필요한 값이 비어있습니다.");
      return false;
    }

    // 신규 품목인 경우 가격 필수
    if (isNewItem && !supplyPrice) {
      alert("신규 품목은 공급가를 입력해주세요.");
      return false;
    }

    setSavingPick((p) => ({ ...p, [itemIndex]: true }));
    setSavedPick((p) => ({ ...p, [itemIndex]: false }));

    try {
      if (isNewItem && supplyPrice) {
        // 신규 품목 저장
        const res = await fetch("/api/learn-new-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientCode: data?.client?.client_code,
            selectedItemNo: canonical,
            selectedName: s?.item_name || "",
            supplyPrice: parseInt(supplyPrice, 10),
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || json?.success === false) {
          alert(`신규 품목 저장 실패:\n${alias} → ${canonical}\n${json?.error ?? ""}`);
          return false;
        }
      } else {
        // 기존 품목 별칭 학습
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
    fontSize: 16, // ✅ 16px 이상으로 설정해야 모바일에서 자동 줌 방지
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Cave De Vin</div>
        
        {/* ===== 탭 메뉴 ===== */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setActiveTab("order")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              backgroundColor: activeTab === "order" ? "#FF6B35" : "transparent",
              color: activeTab === "order" ? "#fff" : "#666",
              fontWeight: activeTab === "order" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            발주 입력
          </button>
          <button
            onClick={() => setActiveTab("learning")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              backgroundColor: activeTab === "learning" ? "#FF6B35" : "transparent",
              color: activeTab === "learning" ? "#fff" : "#666",
              fontWeight: activeTab === "learning" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            학습 관리
          </button>
        </div>
      </div>

      {/* ===== 발주 입력 탭 ===== */}
      {activeTab === "order" && (
        <>
          {/* ===== 거래처 입력칸 (선택 사항) ===== */}
          <div style={{ marginTop: 12 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 6, 
              fontSize: 14, 
              fontWeight: 600,
              color: "#666"
            }}>
              거래처 (선택사항 - 비워두면 첫줄을 거래처로 인식)
            </label>
            <input
              type="text"
              value={clientInput}
              onChange={(e) => setClientInput(e.target.value)}
              placeholder="예: 까사비노"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
            />
          </div>

          {/* ===== 발주 입력칸 ===== */}
          <div style={{ marginTop: 12 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 6, 
              fontSize: 14, 
              fontWeight: 600,
              color: "#666"
            }}>
              발주 내용
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="품목과 수량을 입력하세요"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                ...monoStyle,
              }}
            />
          </div>

      {/* ===== Controls (입력창 아래로 이동) ===== */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "#ccc" : "#FF6B35",
            color: "white",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          {loading ? "생성중..." : "생성"}
        </button>

        <button
          onClick={clearAll}
          disabled={loading || (!text.trim() && !data)}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: loading || (!text.trim() && !data) ? "not-allowed" : "pointer",
            background: loading || (!text.trim() && !data) ? "#f5f5f5" : "#fff",
            fontWeight: 600,
            fontSize: 16,
          }}
          title="입력된 내용을 지우고 결과를 초기화합니다"
        >
          지우기
        </button>

        {/* ===== 클립보드 붙여넣기 버튼 ===== */}
        <button
          onClick={async () => {
            try {
              const clipText = await navigator.clipboard.readText();
              if (clipText) {
                setText(clipText);
              }
            } catch (err) {
              alert("클립보드 접근 권한이 필요합니다.");
            }
          }}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "#f5f5f5" : "#fff",
            fontWeight: 600,
            fontSize: 16,
            marginLeft: "auto",
          }}
          title="클립보드에서 붙여넣기"
        >
          붙여넣기
        </button>
      </div>

      {/* ===== 발주 옵션 (접기/펼치기) ===== */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setShowOrderOptions(!showOrderOptions)}
          style={{
            width: "100%",
            padding: 12,
            background: "#f8f9fa",
            border: "1px solid #ddd",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span>발주 옵션</span>
          <span>{showOrderOptions ? "▲" : "▼"}</span>
        </button>
        
        {showOrderOptions && (
          <div style={{ marginTop: 8, padding: 16, background: "#f8f9fa", borderRadius: 12 }}>
            {/* 배송일 지정 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 6 }}>
                배송일 지정 (선택)
              </label>
              <input
                type="text"
                value={customDeliveryDate}
                onChange={(e) => setCustomDeliveryDate(e.target.value)}
                placeholder="예: 1/10(금), 내일, 1월 10일"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontSize: 16,
                  marginBottom: 8,
                }}
              />
              
              {/* ✅ 날짜 빠른 선택 버튼 (1주일) */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(() => {
                  const dates = [];
                  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
                  const today = new Date();
                  
                  for (let i = 0; i < 7; i++) {
                    const date = new Date(today);
                    date.setDate(today.getDate() + i);
                    const month = date.getMonth() + 1;
                    const day = date.getDate();
                    const weekday = weekdays[date.getDay()];
                    const label = i === 0 ? "오늘" : i === 1 ? "내일" : `${month}/${day}(${weekday})`;
                    const value = `${month}/${day}(${weekday})`;
                    
                    dates.push({ label, value });
                  }
                  
                  return dates.map((d, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCustomDeliveryDate(d.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: customDeliveryDate === d.value ? "2px solid #FF6B35" : "1px solid #ddd",
                        background: customDeliveryDate === d.value ? "#FFF5F2" : "#fff",
                        color: customDeliveryDate === d.value ? "#FF6B35" : "#666",
                        fontSize: 12,
                        fontWeight: customDeliveryDate === d.value ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {d.label}
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* 추가 문구 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={requirePaymentConfirm}
                  onChange={(e) => setRequirePaymentConfirm(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 14 }}>입금확인후 출고</span>
              </label>
              
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={requireInvoice}
                  onChange={(e) => setRequireInvoice(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 14 }}>거래명세표 부탁드립니다</span>
              </label>
            </div>
          </div>
        )}
      </div>

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
            <button
              onClick={() => setShowItemsPanel((v) => !v)}
              style={{
                width: "100%",
                padding: 12,
                background: "#f8f9fa",
                border: "1px solid #ddd",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <span>품목 결과</span>
              <span>{showItemsPanel ? "▲" : "▼"}</span>
            </button>

            {showItemsPanel && (
              <div style={{ marginTop: 8, padding: 16, background: "#f8f9fa", borderRadius: 12 }}>
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

                            {/* 신규 품목 가격 입력 - 맨 위로 이동 */}
                            {!!it.is_new_item && (
                              <div style={{ marginTop: 12, marginBottom: 12, padding: "12px", background: "#fff8f0", borderRadius: 8, border: "1px solid #ffd699" }}>
                                <div style={{ fontSize: 13, color: "#ff6b35", marginBottom: 8, fontWeight: 600 }}>
                                  ⚠️ 신규 품목입니다. 공급가를 입력해주세요
                                </div>
                                <input
                                  type="number"
                                  placeholder="공급가 입력 (예: 15000)"
                                  value={newItemPrices[idx] || ''}
                                  onChange={(e) => setNewItemPrices(prev => ({
                                    ...prev,
                                    [idx]: e.target.value
                                  }))}
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "1px solid #ddd",
                                    borderRadius: 6,
                                    fontSize: 14,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            )}

                            {top3.map((s: any, sidx: number) => {
                              const saving = !!savingPick[idx];
                              const saved = !!savedPick[idx];
                              const isNewItem = !!it.is_new_item;

                              return (
                                <div key={sidx}>
                                  <button
                                    disabled={saving}
                                    style={{
                                      width: "100%",
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
                                      if (isNewItem && !newItemPrices[idx]) {
                                        alert('신규 품목은 가격을 입력해주세요.');
                                        return;
                                      }
                                      const price = isNewItem ? newItemPrices[idx] : undefined;
                                      applySuggestionToResult(idx, s, price);
                                      await learnSelectedAlias(idx, s, price);
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
                                        <b>{s.item_no}</b> / {s.item_name?.split(' / ')[0] || s.item_name}
                                        {isNewItem && (
                                          <span style={{ 
                                            marginLeft: 8, 
                                            padding: "2px 6px",
                                            background: "#ff6b35",
                                            color: "white",
                                            fontSize: 11,
                                            borderRadius: 4,
                                            fontWeight: 600
                                          }}>
                                            신규품목
                                          </span>
                                        )}
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
                                </div>
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
            <button
              onClick={() => setShowLearnInput((v) => !v)}
              style={{
                width: "100%",
                padding: 12,
                background: "#f8f9fa",
                border: "1px solid #ddd",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <span>품목 학습</span>
              <span>{showLearnInput ? "▲" : "▼"}</span>
            </button>

            {showLearnInput && (
              <div style={{ marginTop: 8, padding: 16, background: "#f8f9fa", borderRadius: 12 }}>
                <div style={{ color: "#777", fontSize: 12, marginBottom: 10 }}>
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
              </div>
            )}
          </div>

          {/* ---- Full JSON (toggle) ---- */}
          <div style={{ marginTop: 18 }}>
            <button
              onClick={() => setShowJson((v) => !v)}
              style={{
                width: "100%",
                padding: 12,
                background: "#f8f9fa",
                border: "1px solid #ddd",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <span>JSON</span>
              <span>{showJson ? "▲" : "▼"}</span>
            </button>

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
                  marginTop: 8,
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
          거래처 품목 보기 (거래처 확정 후에만)
      ========================= */}
      {data?.client?.status === "resolved" && data?.client?.client_code && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => {
              if (showClientItems) {
                setShowClientItems(false);
              } else {
                if (clientItems.length === 0) {
                  loadClientItems();
                } else {
                  setShowClientItems(true);
                }
              }
            }}
            disabled={loadingClientItems}
            style={{
              width: "100%",
              padding: 12,
              background: "#f8f9fa",
              border: "1px solid #ddd",
              borderRadius: 12,
              cursor: loadingClientItems ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span>거래처 품목 보기 ({data.client.client_name})</span>
            <span>{loadingClientItems ? "..." : showClientItems ? "▲" : "▼"}</span>
          </button>

          {showClientItems && clientItems.length > 0 && (
            <div style={{ marginTop: 8, padding: 16, background: "#f8f9fa", borderRadius: 12 }}>
              <div
                style={{
                  maxHeight: 400,
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                {clientItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => addItemManually(item)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: idx < clientItems.length - 1 ? "1px solid #f0f0f0" : "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.item_name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          품목코드: {item.item_no}
                        </div>
                      </div>
                      <div style={{ fontSize: 20, color: "#9ca3af" }}>+</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
                품목을 클릭하면 발주 목록에 추가됩니다 (총 {clientItems.length}개)
              </div>
            </div>
          )}
        </div>
      )}

        </>
      )}

      {/* ===== 학습 관리 탭 ===== */}
      {activeTab === "learning" && (
        <>
          {/* =========================
              품목 학습
          ========================= */}
          {/* 품목 학습 입력은 발주 입력 탭에서만 표시되므로 여기서는 제외 */}

          {/* =========================
              학습된 거래처 목록
          ========================= */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setShowLearnedClients((v) => !v)}
          style={{
            width: "100%",
            padding: 12,
            background: "#f8f9fa",
            border: "1px solid #ddd",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span>학습된 거래처</span>
          <span>{showLearnedClients ? "▲" : "▼"}</span>
        </button>

        {showLearnedClients && (
          <div style={{ marginTop: 8, padding: 16, background: "#f8f9fa", borderRadius: 12 }}>
            <LearnedClientList type="wine" version={learnedClientVersion} />
          </div>
        )}
      </div>

      {/* =========================
          학습목록 (UI 통일)
      ========================= */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setShowLearned((v) => !v)}
          style={{
            width: "100%",
            padding: 12,
            background: "#f8f9fa",
            border: "1px solid #ddd",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span>학습목록</span>
          <span>{showLearned ? "▲" : "▼"}</span>
        </button>

        {showLearned && (
          <div style={{ marginTop: 8, padding: 16, background: "#f8f9fa", borderRadius: 12 }}>
            <LearnedAliasList
              version={learnedVersion}
              onChanged={() => setLearnedVersion((v) => v + 1)}
            />
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
