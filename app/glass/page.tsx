"use client";

import { useEffect, useMemo, useState } from "react";
import LearnedAliasList from "@/app/components/LearnedAliasList";
import LearnedClientList from "@/app/components/LearnedClientList";

type LearnRow = { alias: string; canonical: string };

export default function Home({ subTab }: { subTab?: "order" | "learning" }) {
  const [text, setText] = useState("");
  const [clientInput, setClientInput] = useState(""); // ✅ 거래처 입력칸
  const [force, setForce] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ✅ 탭 상태
  const [activeTab, setActiveTab] = useState<"order" | "learning">("order");

  // 부모(ORDER 페이지)에서 전달받은 subTab 동기화
  useEffect(() => {
    if (subTab) setActiveTab(subTab);
  }, [subTab]);

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

  // ✅ 클립보드 내용 있는지 체크
  const [hasClipboard, setHasClipboard] = useState(false);

  // ✅ 자동 붙여넣기 ON/OFF (localStorage 저장)
  const [autoPaste, setAutoPaste] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('order_auto_paste');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  // ✅ 페이지 로드 시 클립보드 내용 자동 붙여넣기
  const [autoLoaded, setAutoLoaded] = useState(false);
  useEffect(() => {
    if (!autoPaste) return;
    const loadClipboard = async () => {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.length > 0) {
          if (!autoLoaded) {
            setText(clip);
            setAutoLoaded(true);
          }
          setHasClipboard(true);
        } else {
          setHasClipboard(false);
        }
      } catch {
        setHasClipboard(false);
      }
    };
    loadClipboard();
  }, [autoPaste, autoLoaded]);

  // ✅ 클립보드 체크 (주기적, autoPaste ON일 때만)
  useEffect(() => {
    if (!autoPaste) return;
    const checkClipboard = async () => {
      try {
        const clip = await navigator.clipboard.readText();
        setHasClipboard(!!clip && clip.length > 0);
      } catch {
        setHasClipboard(false);
      }
    };
    const interval = setInterval(checkClipboard, 3000);
    return () => clearInterval(interval);
  }, [autoPaste]);

  // ✅ 전체 JSON 토글
  const [showJson, setShowJson] = useState(false);

  // ✅ 후보 선택 학습 저장 상태 (itemIndex별)
  const [savingPick, setSavingPick] = useState<Record<number, boolean>>({});
  const [savedPick, setSavedPick] = useState<Record<number, boolean>>({});
  
  // ✅ 직원 메시지 업데이트 플래시 효과
  const [staffMsgFlash, setStaffMsgFlash] = useState(false);
  
  // ✅ 신규 품목 가격 입력
  const [newItemPrices, setNewItemPrices] = useState<Record<number, string>>({});
  
  // ✅ 신규 품목 할인율 입력 (itemIndex별)
  const [newItemDiscounts, setNewItemDiscounts] = useState<Record<number, number>>({});

  // ✅ 더보기 상태 (itemIndex별)
  const [showMoreSuggestions, setShowMoreSuggestions] = useState<Record<number, boolean>>({});

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

  // ✅ 신규 사업자
  const [isNewBusiness, setIsNewBusiness] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessPhone, setNewBusinessPhone] = useState("");
  const [newBusinessEmail, setNewBusinessEmail] = useState(""); // 주소 → 이메일

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
      // ✅ 모든 품목 확정 시 자동 복사
      setTimeout(async () => {
        await copyStaffMessage();
      }, 300);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status]);

  // ✅ 신규/미입고 품목의 공급가를 자동으로 입력란에 채우기 (와인처럼)
  useEffect(() => {
    if (!data?.items) return;
    
    const newPrices: Record<string, string> = {}; // ✅ itemKey 기반
    data.items.forEach((item: any, idx: number) => {
      if (item.suggestions && Array.isArray(item.suggestions)) {
        item.suggestions.forEach((s: any) => {
          const itemKey = `${idx}-${s.code || s.item_no}`; // ✅ 고유 키 생성
          const needsPrice = !!s.is_new_item || !s.in_client_history;
          if (!needsPrice) return;
          // Glass 신규품목은 price 필드 우선
          if (s.price) {
            newPrices[itemKey] = String(s.price);
          }
          // supply_price 폴백
          if (s.supply_price && !newPrices[itemKey]) {
            newPrices[itemKey] = String(s.supply_price);
          }
        });
      }
    });
    
    if (Object.keys(newPrices).length > 0) {
      setNewItemPrices(prev => ({ ...prev, ...newPrices }));
    }
  }, [data?.items]);

  async function callParse(payload: any) {
    const res = await fetch("/api/parse-glass-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      throw new Error("세션이 만료되었습니다. 페이지를 새로고침하여 다시 로그인해주세요.");
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `서버 오류 (${res.status})`);
    }
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
      // ✅ 신규 사업자 체크박스 선택 시
      if (isNewBusiness) {
        if (!newBusinessName.trim() || !newBusinessPhone.trim()) {
          alert("신규 사업자의 사업자명과 연락처를 입력해주세요.");
          setLoading(false);
          return;
        }
        
        // 신규 사업자 직접 메시지 생성
        const { json } = await callParse({
          message: text,
          force_resolve: true,
          customDeliveryDate: customDeliveryDate || undefined,
          requirePaymentConfirm: requirePaymentConfirm || undefined,
          requireInvoice: requireInvoice || undefined,
          newBusiness: {
            name: newBusinessName.trim(),
            phone: newBusinessPhone.trim(),
            email: newBusinessEmail.trim() || undefined, // 이메일로 변경
          },
        });
        setData(json);
        setSavingPick({});
        setSavedPick({});
        setCopied(false);
        setLoading(false);
        return;
      }

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
      console.log("[Glass] API 응답:", JSON.stringify(json).substring(0, 500));
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
    } catch (err: any) {
      alert(err?.message || "발주 분석 중 오류가 발생했습니다.");
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
        body: JSON.stringify({ client_code: clientCode, type: "glass" }),
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

  // ✅ 품목 직접 추가 (수량 입력 상태 관리)
  const [addingItem, setAddingItem] = useState<any>(null);
  const [addingQty, setAddingQty] = useState("1");

  function addItemManually(item: any) {
    setAddingItem(item);
    setAddingQty("1");
  }

  function confirmAddItem() {
    if (!addingItem) return;
    const qty = Number(addingQty);
    if (!qty || isNaN(qty) || qty <= 0) return;

    const newText = text + `\n${addingItem.item_name} ${qty}`;
    setText(newText);
    setAddingItem(null);
    setAddingQty("1");
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
              type: "glass",
            }),
          });
          // ✅ 학습 후 목록 갱신
          setLearnedClientVersion((v) => v + 1);
        } catch (err) {
          console.error("거래처 학습 실패:", err);
        }
      }

      // ✅ 2. 재파싱 (resolvedClientCode 사용)
      const { json } = await callParse({
        message: pendingPreMessage || text,
        resolvedClientCode: clientCode,
        resolvedClientName: clientName,
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
    setClientInput(""); // ✅ 거래처 입력도 초기화
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
        alert(`학습 실패: ${r.alias}\n${json?.error ?? ""}`);
        return;
      }
    }

    resetLearnInputs();
    setLearnedVersion((v) => v + 1); // ✅ 목록 새로고침 트리거
    setShowLearned(true);
    alert("학습 완료");
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
      // alert 제거 - 초록불만으로 충분
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      // alert 제거
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  }

  // ✅ Glass 품목 단위 결정 (API와 동일한 로직)
  // "개" 단위: 디캔터, 박스, 쇼핑백, 클리너, 캐링백, 세트, 밸류팩, 클로스, 린넨
  // "잔" 단위: 그 외 모든 RD 와인잔 (0xxx, 4xxx, 6xxx 등 모든 시리즈)
  function getGlassUnit(itemName: string): string {
    // 1. 명확한 "개" 단위 품목 키워드 (부자재/악세서리)
    if (/디캔터|박스|쇼핑백|클리너|캐링백|세트|밸류팩|폴리싱|클로스|린넨|보틀\s*클리너/i.test(itemName)) {
      return "개";
    }

    // 2. RD 코드가 있는 와인잔 → 잔 (모든 시리즈)
    const rdMatch = itemName.match(/RD\s+(\d{4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i);
    if (rdMatch) {
      return "잔";
    }

    // 3. 품목명에 "레스토랑" 포함 → 잔
    if (/레스토랑/i.test(itemName)) {
      return "잔";
    }

    // 4. 코드만 입력된 경우 → 잔
    const codeOnly = itemName.match(/^0?\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?$/i);
    if (codeOnly) {
      return "잔";
    }

    // 5. 기본 → 개
    return "개";
  }

  // ✅ 선택 즉시 화면 반영(직원메시지 + items) + 플래시 효과
  function applySuggestionToResult(itemIndex: number, s: any, price?: string) {
    // ✅ 직원 메시지 업데이트 플래시
    setStaffMsgFlash(true);
    setTimeout(() => setStaffMsgFlash(false), 1200);
    setData((prev: any) => {
      if (!prev) return prev;

      const next = { ...prev };
      const items = Array.isArray(next.items) ? [...next.items] : [];
      const target = items[itemIndex];
      if (!target) return prev;

      const qty = target.qty;
      const isNewItem = !!s.is_new_item;

      // ✅ 올바른 단위 결정 (품목명에서 RD 코드 추출)
      const unit = getGlassUnit(s.item_name || "");

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
      
      // ✅ 모든 가능한 단위로 이전 라인 검색
      const possibleUnits = ["병", "잔", "개"];
      let oldLineUnresolved = "";
      let oldLineResolved = "";
      let foundUnit = "병"; // 기본값
      
      for (const u of possibleUnits) {
        const testUnresolved = `- 확인필요 / "${target.name}" / ${qty}${u}`;
        const testResolved = target?.item_no
          ? `- ${target.item_no} / ${target.item_name} / ${qty}${u}`
          : "";
        
        if (staff.includes(testUnresolved)) {
          oldLineUnresolved = testUnresolved;
          foundUnit = u;
          break;
        }
        if (testResolved && staff.includes(testResolved)) {
          oldLineResolved = testResolved;
          foundUnit = u;
          break;
        }
      }
      
      if (!oldLineUnresolved && !oldLineResolved) {
        // 기본값으로 설정
        oldLineUnresolved = `- 확인필요 / "${target.name}" / ${qty}병`;
        oldLineResolved = target?.item_no
          ? `- ${target.item_no} / ${target.item_name} / ${qty}병`
          : "";
      }

      // ✅ 신규/미입고 품목일 때 가격 포함, 올바른 단위 사용
      const koreanName = s.item_name?.split(' / ')[0] || s.item_name;
      const newLine = price
        ? `- ${s.code || s.item_no} / ${koreanName} / ${qty}${unit} / ${parseInt(price, 10).toLocaleString()}원`
        : `- ${s.code || s.item_no} / ${koreanName} / ${qty}${unit}`;

      if (staff.includes(oldLineUnresolved)) {
        next.staff_message = staff.replace(oldLineUnresolved, newLine);
      } else if (oldLineResolved && staff.includes(oldLineResolved)) {
        next.staff_message = staff.replace(oldLineResolved, newLine);
      } else {
        // fallback: 모든 단위 검색
        next.staff_message = staff
          .split("\n")
          .map((line) => {
            // 모든 단위로 검색
            const hasQtyWithAnyUnit = possibleUnits.some(u => line.includes(`${qty}${u}`));
            if (!hasQtyWithAnyUnit) return line;

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
  async function learnSelectedAlias(itemIndex: number, s: any, price?: string) {
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
      const clientCode = String(data?.client?.client_code ?? "").trim();
      const res = await fetch("/api/learn-item-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          alias, 
          canonical,
          client_code: clientCode || '*',
          dataType: 'glass',
          ...(price ? { price: Number(price) } : {})
        }),
      });

      const json = await res.json().catch(() => null);

      if (
        !res.ok ||
        json?.success === false ||
        (typeof json?.saved === "number" && json.saved < 1)
      ) {
        alert(`학습 실패:\n${alias} → ${canonical}\n${json?.error ?? ""}`);
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
    padding: 14,
    border: "1px solid rgba(90,21,21,0.06)",
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 1px 3px rgba(90,21,21,0.03)",
  };
  const monoStyle: React.CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 16, // ✅ 16px 이상으로 설정해야 모바일에서 자동 줌 방지
  };

  // ✅ 후보는 최대 5개까지 보여주기 (기존 2개 + 신규 3개)
  // ✅ 후보 가져오기 (확정 품목: 기본 2개, 미확정: 기본 5개, 더보기: 20개)
  function getSuggestions(it: any, showMore: boolean) {
    let arr = (Array.isArray(it?.suggestions) && it.suggestions.length > 0)
      ? it.suggestions
      : Array.isArray(it?.candidates)
        ? it.candidates
        : [];
    
    // 기존 품목(입고이력) 우선 정렬
    arr = [...arr].sort((a: any, b: any) => {
      const aIsExisting = !a.is_new_item && a.in_client_history;
      const bIsExisting = !b.is_new_item && b.in_client_history;
      if (aIsExisting && !bIsExisting) return -1;
      if (!aIsExisting && bIsExisting) return 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
    
    const isResolved = it?.resolved === true;
    if (showMore) {
      return arr.slice(0, 20);
    } else {
      return isResolved ? arr.slice(0, 2) : arr.slice(0, 5);
    }
  }

  const needsClientPick = data?.status === "needs_review_client";

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "0 16px 32px",
        fontFamily: "'DM Sans', -apple-system, sans-serif",
      }}
    >

      {/* ===== 발주 입력 탭 ===== */}
      {activeTab === "order" && (
        <>
          {/* ===== 입력 카드 ===== */}
          <div style={{
            marginTop: 16,
            background: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(90,21,21,0.06)",
            boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
            padding: "20px 18px 18px",
          }}>
            {/* 거래처 입력칸 */}
            <div>
              <label style={{
                display: "block",
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#8a8580",
                letterSpacing: "0.03em",
                textTransform: "uppercase" as const,
              }}>
                거래처
              </label>
              <input
                type="text"
                value={clientInput}
                onChange={(e) => setClientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    e.preventDefault();
                    run();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    e.preventDefault();
                    run();
                  }
                }}
                placeholder="거래처를 입력하세요"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(90,21,21,0.08)",
                  fontSize: 16,
                  background: "#faf9f7",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(90,21,21,0.25)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(90,21,21,0.06)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(90,21,21,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* 구분선 */}
            <div style={{ height: 1, background: "rgba(90,21,21,0.05)", margin: "16px 0" }} />

            {/* 발주 내용 입력칸 */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#8a8580",
                  letterSpacing: "0.03em",
                  textTransform: "uppercase" as const,
                }}>
                  발주 내용
                </label>
                <div
                  role="button"
                  tabIndex={-1}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const next = !autoPaste;
                    setAutoPaste(next);
                    localStorage.setItem('order_auto_paste', String(next));
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    cursor: "pointer", userSelect: "none",
                    fontSize: 12, color: autoPaste ? "#5A1515" : "#aaa",
                    fontWeight: 500,
                  }}
                >
                  <div style={{
                    width: 34, height: 20, borderRadius: 10,
                    background: autoPaste ? "#5A1515" : "#d4d0cc",
                    position: "relative", transition: "background 0.25s cubic-bezier(0.4,0,0.2,1)",
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 8,
                      background: "#fff", position: "absolute", top: 2,
                      left: autoPaste ? 16 : 2,
                      transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    }} />
                  </div>
                  자동 붙여넣기
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !loading) {
                    e.preventDefault();
                    run();
                  }
                }}
                rows={8}
                placeholder="품목과 수량을 입력하세요"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(90,21,21,0.08)",
                  fontSize: 16,
                  background: "#faf9f7",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                  ...monoStyle,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(90,21,21,0.25)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(90,21,21,0.06)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(90,21,21,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* ===== Action Bar ===== */}
            <div style={{
              display: "flex",
              gap: 6,
              marginTop: 14,
              alignItems: "center",
            }}>
              <button
                onClick={run}
                disabled={loading}
                style={{
                  padding: "9px 22px",
                  borderRadius: 10,
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: loading ? "rgba(90,21,21,0.6)" : "#5A1515",
                  color: "#fff",
                  boxShadow: loading ? "none" : "0 2px 8px rgba(90,21,21,0.2)",
                  whiteSpace: "nowrap" as const,
                  letterSpacing: "0.02em",
                }}
              >
                {loading ? "생성중..." : "생성"}
              </button>

              <button
                onClick={clearAll}
                disabled={loading || (!text.trim() && !data)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: "1.5px solid rgba(90,21,21,0.08)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: loading || (!text.trim() && !data) ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  background: "transparent",
                  color: loading || (!text.trim() && !data) ? "#ccc" : "#8a8580",
                  whiteSpace: "nowrap" as const,
                }}
                title="입력된 내용을 지우고 결과를 초기화합니다"
              >
                지우기
              </button>

              <div style={{ flex: 1 }} />

              {/* 클립보드 붙여넣기 */}
              <div
                role="button"
                tabIndex={-1}
                onPointerDown={async (e) => {
                  e.preventDefault();
                  if (loading) return;
                  try {
                    const clipText = await navigator.clipboard.readText();
                    if (clipText) {
                      setText(clipText);
                      setHasClipboard(false);
                    }
                  } catch (err) {
                    alert("클립보드 접근 권한이 필요합니다.");
                  }
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: hasClipboard ? "1.5px solid rgba(90,21,21,0.15)" : "1.5px solid rgba(90,21,21,0.08)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: hasClipboard ? "rgba(90,21,21,0.04)" : "transparent",
                  color: hasClipboard ? "#5A1515" : "#8a8580",
                  userSelect: "none",
                  WebkitTouchCallout: "none",
                  whiteSpace: "nowrap",
                } as React.CSSProperties}
              >
                붙여넣기
              </div>
            </div>
          </div>

      {/* ===== 신규 사업자 + 발주 옵션 ===== */}
      <div style={{
        marginTop: 12,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid rgba(90,21,21,0.06)",
        boxShadow: "0 1px 4px rgba(90,21,21,0.02)",
        overflow: "hidden",
      }}>
        {/* 신규 사업자 */}
        <div style={{ padding: "14px 18px", borderBottom: isNewBusiness ? "1px solid rgba(90,21,21,0.06)" : "none" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6,
              border: isNewBusiness ? "none" : "1.5px solid rgba(90,21,21,0.15)",
              background: isNewBusiness ? "#5A1515" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}>
              {isNewBusiness && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>&#10003;</span>}
            </div>
            <input
              type="checkbox"
              checked={isNewBusiness}
              onChange={(e) => {
                setIsNewBusiness(e.target.checked);
                if (!e.target.checked) {
                  setNewBusinessName("");
                  setNewBusinessPhone("");
                  setNewBusinessEmail("");
                }
              }}
              style={{ display: "none" }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#2c1810" }}>신규 사업자</span>
          </label>
        </div>

        {isNewBusiness && (
          <div style={{ padding: "16px 18px", background: "rgba(90,21,21,0.02)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#8a8580", display: "block", marginBottom: 6, letterSpacing: "0.03em" }}>
                  사업자명 <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input type="text" value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)} placeholder="예: 홍길동 레스토랑"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(90,21,21,0.08)", fontSize: 16, background: "#fff", outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#8a8580", display: "block", marginBottom: 6, letterSpacing: "0.03em" }}>
                  연락처 <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input type="text" value={newBusinessPhone} onChange={(e) => setNewBusinessPhone(e.target.value)} placeholder="예: 010-1234-5678"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(90,21,21,0.08)", fontSize: 16, background: "#fff", outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#8a8580", display: "block", marginBottom: 6, letterSpacing: "0.03em" }}>
                  세금계산서 이메일 (선택)
                </label>
                <input type="email" value={newBusinessEmail} onChange={(e) => setNewBusinessEmail(e.target.value)} placeholder="예: admin@company.com"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(90,21,21,0.08)", fontSize: 16, background: "#fff", outline: "none" }} />
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: "#8a7a6e", background: "rgba(90,21,21,0.03)", padding: "10px 12px", borderRadius: 10, lineHeight: 1.5 }}>
              신규 사업자는 거래처 DB에 등록되지 않은 사업자입니다. 사업자명과 연락처를 입력하면 주문서가 생성됩니다.
            </div>
          </div>
        )}

        {/* 발주 옵션 */}
        <div style={{ borderTop: "1px solid rgba(90,21,21,0.06)" }}>
          <button
            onClick={() => setShowOrderOptions(!showOrderOptions)}
            style={{
              width: "100%",
              padding: "14px 18px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 14,
              fontWeight: 600,
              color: "#2c1810",
            }}
          >
            <span>발주 옵션</span>
            <span style={{ fontSize: 11, color: "#8a8580", transition: "transform 0.2s ease", transform: showOrderOptions ? "rotate(180deg)" : "rotate(0deg)" }}>&#9660;</span>
          </button>

          {showOrderOptions && (
            <div style={{ padding: "0 18px 18px" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#8a8580", display: "block", marginBottom: 8, letterSpacing: "0.03em" }}>
                  배송일 지정 (선택)
                </label>
                <input type="text" value={customDeliveryDate} onChange={(e) => setCustomDeliveryDate(e.target.value)} placeholder="예: 1/10(금), 내일, 1월 10일"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(90,21,21,0.08)", fontSize: 16, background: "#faf9f7", marginBottom: 10, outline: "none" }} />

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
                    return dates.map((d, idx) => {
                      const isSelected = customDeliveryDate === d.value;
                      return (
                        <button key={idx} onClick={() => setCustomDeliveryDate(d.value)}
                          style={{ padding: "6px 14px", borderRadius: 8, border: isSelected ? "1.5px solid #5A1515" : "1.5px solid rgba(90,21,21,0.08)", background: isSelected ? "rgba(90,21,21,0.06)" : "#fff", color: isSelected ? "#5A1515" : "#8a8580", fontSize: 12, fontWeight: isSelected ? 700 : 500, cursor: "pointer", transition: "all 0.2s ease" }}>
                          {d.label}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: requirePaymentConfirm ? "none" : "1.5px solid rgba(90,21,21,0.15)", background: requirePaymentConfirm ? "#5A1515" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", flexShrink: 0 }}>
                    {requirePaymentConfirm && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>&#10003;</span>}
                  </div>
                  <input type="checkbox" checked={requirePaymentConfirm} onChange={(e) => setRequirePaymentConfirm(e.target.checked)} style={{ display: "none" }} />
                  <span style={{ fontSize: 14, color: "#2c1810" }}>입금확인후 출고</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: requireInvoice ? "none" : "1.5px solid rgba(90,21,21,0.15)", background: requireInvoice ? "#5A1515" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", flexShrink: 0 }}>
                    {requireInvoice && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>&#10003;</span>}
                  </div>
                  <input type="checkbox" checked={requireInvoice} onChange={(e) => setRequireInvoice(e.target.checked)} style={{ display: "none" }} />
                  <span style={{ fontSize: 14, color: "#2c1810" }}>거래명세표 부탁드립니다</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ API 에러 표시 ═══ */}
      {data && !data.success && (
        <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 12,
          background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)",
          color: "#dc2626", fontSize: 14, fontWeight: 500,
        }}>
          {data.error || "알 수 없는 오류가 발생했습니다."}
        </div>
      )}

      {/* ═══ API 응답 디버그 (임시) ═══ */}
      {data && !data.items && !needsClientPick && data.success && (
        <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 12,
          background: "rgba(217,119,6,0.05)", border: "1px solid rgba(217,119,6,0.15)",
          color: "#92400e", fontSize: 13,
        }}>
          API 응답은 성공했지만 품목이 없습니다. (status: {data.status || "없음"})
        </div>
      )}

      {/* =========================
          ✅ 거래처 선택 패널
      ========================= */}
      {data && needsClientPick && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(90,21,21,0.06)",
            boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 18px 12px",
              borderBottom: "1px solid rgba(90,21,21,0.06)",
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#2c1810" }}>
                거래처 선택이 필요합니다
              </div>
              <div style={{ color: "#8a8580", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                입력된 거래처가 여러 후보로 매칭되었습니다. 아래에서 선택하세요.
              </div>
            </div>

            <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {(clientCandidates ?? []).map((c, idx) => (
                <button
                  key={`${c.client_code}-${idx}`}
                  onClick={() => pickClient(c)}
                  disabled={loading}
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1.5px solid rgba(90,21,21,0.08)",
                    cursor: loading ? "not-allowed" : "pointer",
                    background: "#faf9f7",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#2c1810" }}>{c.client_name}</div>
                  <div style={{ fontSize: 12, color: "#8a8580", marginTop: 4 }}>
                    코드: {c.client_code} · 점수: {c.score}
                  </div>
                </button>
              ))}

              {(clientCandidates ?? []).length === 0 && (
                <div style={{ color: "#8a8580", fontSize: 12, padding: 8 }}>
                  후보가 비어 있습니다.
                </div>
              )}

              <div style={{ marginTop: 4, fontSize: 12, color: "#a8a098" }}>
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
        </div>
      )}

      {/* =========================
          ✅ 거래처 선택이 아닌 경우에만 기존 출력 표시
      ========================= */}
      {data && !needsClientPick && (
        <div style={{ marginTop: 16 }}>
          {/* ---- Staff Message ---- */}
          <div style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(90,21,21,0.06)",
            boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              borderBottom: "1px solid rgba(90,21,21,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#2c1810" }}>직원 메시지</div>
                {data?.status === "resolved" && (
                  <span style={{ fontSize: 11, padding: "2px 8px", background: "#10b981", color: "white", borderRadius: 10, fontWeight: 600 }}>
                    전체 확정
                  </span>
                )}
                {data?.status === "needs_review_items" && (
                  <span style={{ fontSize: 11, padding: "2px 8px", background: "#e8a820", color: "white", borderRadius: 10, fontWeight: 600 }}>
                    확인 필요
                  </span>
                )}
              </div>

              <button
                onClick={copyStaffMessage}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: copied ? "1.5px solid rgba(16,185,129,0.3)" : "1.5px solid rgba(90,21,21,0.08)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  background: copied ? "rgba(16,185,129,0.06)" : "transparent",
                  color: copied ? "#10b981" : "#5A1515",
                  transition: "all 0.25s ease",
                }}
              >
                {copied ? "복사됨 ✓" : "복사하기"}
              </button>
            </div>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                padding: "14px 18px",
                margin: 0,
                background: "transparent",
                lineHeight: 1.7,
                ...monoStyle,
              }}
            >
              {String(data.staff_message ?? "")}
            </pre>
          </div>

          {/* ---- Summary ---- */}
          <div style={{ marginTop: 12 }}>
            <div style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid rgba(90,21,21,0.06)",
              boxShadow: "0 1px 4px rgba(90,21,21,0.02)",
              padding: "14px 18px",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#2c1810", marginBottom: 10 }}>
                요약
              </div>
              <div style={{ marginBottom: 10, fontSize: 14 }}>
                거래처: <b style={{ color: "#5A1515" }}>{String(data?.client?.client_name ?? "")}</b>
                <span style={{ color: "#a8a098", marginLeft: 6, fontSize: 12 }}>
                  {String(data?.client?.client_code ?? "")}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(Array.isArray(data?.parsed_items) ? data.parsed_items : []).map(
                  (p: any, idx: number) => (
                    <div key={idx} style={{ ...monoStyle, color: "#4a4540", fontSize: 13 }}>
                      {String(p?.raw ?? "")}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ---- Items (toggle) ---- */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setShowItemsPanel((v) => !v)}
              style={{
                width: "100%",
                padding: "14px 18px",
                background: "#fff",
                border: "1px solid rgba(90,21,21,0.06)",
                borderRadius: showItemsPanel ? "16px 16px 0 0" : 16,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 700,
                color: "#2c1810",
                boxShadow: "0 1px 4px rgba(90,21,21,0.02)",
                transition: "border-radius 0.2s ease",
              }}
            >
              <span>품목 결과</span>
              <span style={{
                fontSize: 11,
                color: "#8a8580",
                transition: "transform 0.2s ease",
                transform: showItemsPanel ? "rotate(180deg)" : "rotate(0deg)",
              }}>&#9660;</span>
            </button>

            {showItemsPanel && (
              <div style={{
                padding: "16px 18px",
                background: "#fff",
                borderRadius: "0 0 16px 16px",
                border: "1px solid rgba(90,21,21,0.06)",
                borderTop: "none",
                boxShadow: "0 2px 8px rgba(90,21,21,0.03)",
              }}>
                {(Array.isArray(data?.items) ? data.items : []).map(
                  (it: any, idx: number) => {
                    const resolvedUnit = it?.resolved && it?.item_name ? getGlassUnit(it.item_name) : getGlassUnit(it?.item_name || it?.name || "");
                    const line = it?.resolved
                      ? `${it.item_no} / ${it.item_name} / ${it.qty}${resolvedUnit}`
                      : it?.item_no && it?.not_in_client_history
                        ? `${it.item_no} / ${it.item_name} / ${it.qty}${getGlassUnit(it?.item_name || it?.name || "")}`
                        : `확인필요 / "${it.name}" / ${it.qty}${getGlassUnit(it?.item_name || it?.name || "")}`;

                    const showMore = !!showMoreSuggestions[idx];
                    const top3 = getSuggestions(it, showMore);
                    const allSuggestions = (Array.isArray(it?.suggestions) && it.suggestions.length > 0)
                      ? it.suggestions
                      : Array.isArray(it?.candidates) ? it.candidates : [];
                    const wasJustPicked = !!savedPick[idx]; // ✅ 이 아이템이 방금 선택됨
                    const isNotInClientHistory = !!it?.not_in_client_history && !it?.resolved;

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          borderBottom:
                            idx === data.items.length - 1
                              ? "none"
                              : "1px solid #f2f2f2",
                          display: "flex",
                          gap: 10,
                          flexDirection: "column",
                          // ✅ 확정된 아이템은 녹색 배경
                          background: it?.resolved
                            ? wasJustPicked
                              ? "#d4edda" // 방금 선택한 건 진한 녹색
                              : "#eaf7ee" // 기존 확정 건은 연한 녹색
                            : "transparent",
                          borderRadius: 8,
                          transition: "background 0.4s ease",
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div
                            style={{
                              width: 80,
                              color: it?.resolved ? "#10b981" : isNotInClientHistory ? "#e8a820" : "#b00",
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            {it?.resolved ? "확정 ✅" : isNotInClientHistory ? "미입고 ⚠️" : "확인 ❗"}
                          </div>
                          <div style={{ flex: 1, ...monoStyle, fontSize: 13 }}>{line}</div>
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

                        {/* ⚠️ 거래처 미입고 경고 */}
                        {isNotInClientHistory && (
                          <div style={{
                            marginLeft: 0,
                            padding: "8px 12px",
                            background: "#fff8e1",
                            border: "1px solid #ffc107",
                            borderRadius: 6,
                            fontSize: 12,
                            color: "#856404",
                            fontWeight: 600,
                          }}>
                            ⚠️ 이 거래처에 입고된 적 없는 품목입니다. 코드 매칭은 확인되었으나 확인이 필요합니다.
                          </div>
                        )}

                        {/* 후보 선택 버튼 (확정 아이템도 더보기로 볼 수 있음) */}
                        {(top3.length > 0 || allSuggestions.length > 0) && (!it?.resolved || showMore) && (
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

                            {/* 신규/미입고 품목이 있을 때만 안내 표시 */}
                            {top3.some((s: any) => s.is_new_item || !s.in_client_history) && (
                              <div style={{ fontSize: 12, color: "#5A1515", marginBottom: 8, padding: "8px 12px", background: "rgba(90,21,21,0.04)", borderRadius: 6, border: "1px solid rgba(90,21,21,0.15)" }}>
                                ⚠️ 신규/미입고 품목: 할인율과 공급가를 확인하세요
                              </div>
                            )}

                            {top3.map((s: any, sidx: number) => {
                              const itemKey = `${idx}-${s.code || s.item_no}`; // ✅ 고유 키 생성
                              const saving = !!savingPick[idx];
                              const saved = !!savedPick[idx];
                              const isNewItem = !!s.is_new_item;
                              
                              const inClientHistory = !!s.in_client_history;
                              // ✅ 신규품목 OR 미입고 품목 → 할인율/공급가 입력 UI 표시 (와인처럼)
                              const needsPriceInput = isNewItem || !inClientHistory;

                              return (
                                <div key={sidx} style={{ marginBottom: 6, padding: "8px", background: saving ? "#f5f5f5" : saved ? "rgba(16,185,129,0.06)" : "#ffffff", borderRadius: 6, border: "1px solid rgba(90,21,21,0.08)" }}>
                                  {/* 품목명 + 배지 + 점수 (한 줄) */}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                                    <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      <b>{s.item_no}</b>
                                      <span style={{ color: "#333", marginLeft: 6 }}>
                                        {s.item_name?.split(' / ')[0] || s.item_name}
                                      </span>
                                      {isNewItem && (
                                        <span style={{ marginLeft: 6, padding: "1px 4px", background: "#5A1515", color: "white", fontSize: 10, borderRadius: 3, fontWeight: 600 }}>
                                          신규
                                        </span>
                                      )}
                                      {!isNewItem && inClientHistory && (
                                        <span style={{ marginLeft: 6, padding: "1px 4px", background: "#10b981", color: "white", fontSize: 10, borderRadius: 3, fontWeight: 600 }}>
                                          입고이력
                                        </span>
                                      )}
                                      {!isNewItem && !inClientHistory && (
                                        <span style={{ marginLeft: 6, padding: "1px 4px", background: "#e8a820", color: "white", fontSize: 10, borderRadius: 3, fontWeight: 600 }}>
                                          미입고
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 10, color: "#888", marginLeft: 8 }}>{Number(s.score || 0).toFixed(3)}</span>
                                  </div>

                                  {/* 🔥 공급가 항상 표시 (있으면) */}
                                  {s.supply_price && (
                                    <div style={{ marginBottom: 6, fontSize: 11, color: "#10b981", fontWeight: 600 }}>
                                      공급가: {Number(s.supply_price).toLocaleString()}원
                                    </div>
                                  )}

                                  {/* 신규품목 OR 미입고 품목이면 가격/할인 입력 (와인처럼) */}
                                  {needsPriceInput && (
                                    <div style={{ marginBottom: 6 }}>
                                      {/* 공급가 + 할인율 (한 줄로 통합) */}
                                      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                                        <div style={{ flex: "0 0 auto", fontSize: 10, color: "#666" }}>공급가</div>
                                        <input
                                          type="number"
                                          placeholder="25000"
                                          value={newItemPrices[itemKey] || s.supply_price || ''}
                                          onChange={(e) => setNewItemPrices(prev => ({ ...prev, [itemKey]: e.target.value }))}
                                          style={{
                                            flex: "0 0 120px",
                                            padding: "4px 8px",
                                            border: "1px solid rgba(90,21,21,0.1)",
                                            borderRadius: 4,
                                            fontSize: 12,
                                          }}
                                        />
                                        {/* 할인율 버튼 (같은 줄) */}
                                        {[10, 15, 20, 25, 30].map((discount) => (
                                          <button
                                            key={discount}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setNewItemDiscounts(prev => ({ ...prev, [itemKey]: discount }));
                                            }}
                                            style={{
                                              padding: "4px 8px",
                                              border: `1px solid ${newItemDiscounts[itemKey] === discount ? '#5A1515' : '#ddd'}`,
                                              borderRadius: 4,
                                              background: newItemDiscounts[itemKey] === discount ? 'rgba(90,21,21,0.06)' : 'white',
                                              cursor: "pointer",
                                              fontSize: 11,
                                              fontWeight: newItemDiscounts[itemKey] === discount ? 600 : 400,
                                              color: newItemDiscounts[itemKey] === discount ? '#5A1515' : '#666',
                                            }}
                                          >
                                            {discount}%
                                          </button>
                                        ))}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const custom = prompt("할인율 입력 (%):", "0");
                                            if (custom && !isNaN(Number(custom))) {
                                              setNewItemDiscounts(prev => ({ ...prev, [itemKey]: Number(custom) }));
                                            }
                                          }}
                                          style={{
                                            padding: "4px 8px",
                                            border: "1px solid rgba(90,21,21,0.1)",
                                            borderRadius: 4,
                                            background: "white",
                                            cursor: "pointer",
                                            fontSize: 11,
                                            color: "#666",
                                          }}
                                        >
                                          직접
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* 적용 버튼 (작게) */}
                                  <button
                                    disabled={saving}
                                    onClick={async () => {
                                      // ✅ 공급가 계산: 입력값 > supply_price > undefined
                                      const inputPrice = newItemPrices[itemKey] || (s.supply_price ? String(s.supply_price) : '');
                                      let finalPrice = inputPrice;
                                      if (needsPriceInput && inputPrice && newItemDiscounts[itemKey] > 0) {
                                        const basePrice = Number(inputPrice);
                                        const discount = newItemDiscounts[itemKey];
                                        finalPrice = String(Math.round(basePrice * (1 - discount / 100)));
                                      }
                                      const price = needsPriceInput && finalPrice ? finalPrice : undefined;
                                      applySuggestionToResult(idx, s, price);
                                      await learnSelectedAlias(idx, s, price);
                                    }}
                                    style={{
                                      width: "100%",
                                      padding: "6px 12px",
                                      borderRadius: 6,
                                      border: "none",
                                      background: saved ? "#10b981" : "#5A1515",
                                      color: "white",
                                      cursor: saving ? "not-allowed" : "pointer",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      opacity: saving ? 0.5 : 1,
                                    }}
                                  >
                                    {saving ? "처리중..." : saved ? "적용됨 ✅" : "적용"}
                                  </button>
                                </div>
                              );
                            })}

                            {/* 더보기 버튼 */}
                            <button
                              onClick={() => {
                                setShowMoreSuggestions(prev => ({
                                  ...prev,
                                  [idx]: !prev[idx]
                                }));
                              }}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                marginTop: 8,
                                borderRadius: 6,
                                border: "1px solid rgba(90,21,21,0.1)",
                                background: "white",
                                color: "#5A1515",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {showMore
                                ? `▲ 접기 (${allSuggestions.length}개 중 ${Math.min(20, allSuggestions.length)}개 표시)`
                                : it?.resolved
                                  ? (allSuggestions.length > 2
                                      ? `▼ 더보기 (${allSuggestions.length}개 중 2개 표시)`
                                      : `총 ${allSuggestions.length}개 후보`)
                                  : (allSuggestions.length > 5
                                      ? `▼ 더보기 (${allSuggestions.length}개 중 5개 표시)`
                                      : `총 ${allSuggestions.length}개 후보`)}
                            </button>
                          </div>
                        )}

                        {/* 확정된 아이템에 대한 간단 안내 */}
                        {it?.resolved && wasJustPicked && (
                          <div style={{ marginLeft: 80, fontSize: 12, color: "#10b981", fontWeight: 600 }}>
                            직원 메시지에 반영되었습니다
                          </div>
                        )}

                        {/* 확정된 아이템: 더보기 버튼만 표시 */}
                        {it?.resolved && !showMore && allSuggestions.length > 0 && (
                          <div style={{ marginLeft: 80 }}>
                            <button
                              onClick={() => setShowMoreSuggestions(prev => ({ ...prev, [idx]: true }))}
                              style={{
                                padding: "6px 12px",
                                marginTop: 4,
                                borderRadius: 6,
                                border: "1px solid rgba(90,21,21,0.1)",
                                background: "white",
                                color: "#5A1515",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              ▼ 다른 후보 보기 ({allSuggestions.length}개)
                            </button>
                          </div>
                        )}

                        {top3.length === 0 && !it?.resolved && (
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
                background: "#fafaf8",
                border: "1px solid rgba(90,21,21,0.1)",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span>품목 학습</span>
              <span>{showLearnInput ? "▲" : "▼"}</span>
            </button>

            {showLearnInput && (
              <div style={{ marginTop: 8, padding: 16, background: "#fafaf8", borderRadius: 12 }}>
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
                          border: "1px solid rgba(90,21,21,0.1)",
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
                          border: "1px solid rgba(90,21,21,0.1)",
                        }}
                      />
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button
                      onClick={saveLearnInputs}
                      disabled={!canSave}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid rgba(90,21,21,0.1)",
                        cursor: canSave ? "pointer" : "not-allowed",
                        opacity: canSave ? 1 : 0.5,
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#fff",
                      }}
                    >
                      학습 저장
                    </button>

                    <button
                      onClick={resetLearnInputs}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid rgba(90,21,21,0.1)",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
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
                background: "#fafaf8",
                border: "1px solid rgba(90,21,21,0.1)",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 13,
                fontWeight: 600,
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
                  border: "1px solid rgba(90,21,21,0.06)",
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
              background: "#fafaf8",
              border: "1px solid rgba(90,21,21,0.1)",
              borderRadius: 12,
              cursor: loadingClientItems ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>거래처 품목 보기 ({data.client.client_name})</span>
            <span>{loadingClientItems ? "..." : showClientItems ? "▲" : "▼"}</span>
          </button>

          {showClientItems && clientItems.length > 0 && (
            <div style={{ marginTop: 8, padding: 16, background: "#fafaf8", borderRadius: 12 }}>
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
                    style={{
                      padding: "12px 16px",
                      borderBottom: idx < clientItems.length - 1 ? "1px solid #f0f0f0" : "none",
                      background: addingItem?.item_no === item.item_no ? "#f0fdf4" : "#fff",
                    }}
                  >
                    {addingItem?.item_no === item.item_no ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>
                          {item.item_name}
                        </div>
                        <input
                          type="number"
                          value={addingQty}
                          onChange={(e) => setAddingQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmAddItem(); }}
                          autoFocus
                          style={{
                            width: 60,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            fontSize: 16,
                            textAlign: "center",
                          }}
                          min="1"
                        />
                        <button
                          onClick={confirmAddItem}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "#10b981",
                            color: "white",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          추가
                        </button>
                        <button
                          onClick={() => setAddingItem(null)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            background: "white",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => addItemManually(item)}
                        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{item.item_name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                            품목코드: {item.item_no}
                          </div>
                        </div>
                        <div style={{ fontSize: 20, color: "#9ca3af" }}>+</div>
                      </div>
                    )}
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
              학습된 거래처 목록
          ========================= */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setShowLearnedClients((v) => !v)}
          style={{
            width: "100%",
            padding: 12,
            background: "#fafaf8",
            border: "1px solid rgba(90,21,21,0.1)",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>학습된 거래처</span>
          <span>{showLearnedClients ? "▲" : "▼"}</span>
        </button>

        {showLearnedClients && (
          <div style={{ marginTop: 8, padding: 16, background: "#fafaf8", borderRadius: 12 }}>
            <LearnedClientList type="glass" version={learnedClientVersion} />
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
            background: "#fafaf8",
            border: "1px solid rgba(90,21,21,0.1)",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>학습목록</span>
          <span>{showLearned ? "▲" : "▼"}</span>
        </button>

        {showLearned && (
          <div style={{ marginTop: 8, padding: 16, background: "#fafaf8", borderRadius: 12 }}>
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
