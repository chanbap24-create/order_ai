// ==UserScript==
// @name         시음주 결재 자동채우기 (eKP 지출결의서)
// @namespace    order-ai
// @version      1.0.0
// @description  시음주 결재 데이터를 eKP 지출결의서 기안 폼에 자동 입력. 각 프레임에 떠있는 버튼을 그려 프레임 격리 우회.
// @match        https://wp.ebizworks.co.kr/*
// @match        https://*.ebizworks.co.kr/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// ==/UserScript==
//
// [사용법]
// 1) 우리 '시음주 결재' 탭 → 거래처 카드의 [JSON 복사].
// 2) eKP 폼 화면 좌상단에 떠있는 빨간 [🍷 시음주 채우기] 버튼 클릭.
//    → 복사한 JSON을 자동으로 읽어 폼을 채움(클립보드가 막히면 붙여넣기 창).
// ※ 결재선/첨부/최종 '결재상신'은 직접.

(function () {
  "use strict";

  const norm = (s) => (s || "").replace(/\s+/g, "").trim();

  function allDocs() {
    const out = [];
    const walk = (doc) => {
      if (!doc || out.includes(doc)) return;
      out.push(doc);
      let frames;
      try { frames = doc.querySelectorAll("iframe, frame"); } catch (e) { return; }
      frames.forEach((f) => {
        try { if (f.contentDocument) walk(f.contentDocument); } catch (e) { /* cross-origin */ }
      });
    };
    let top = document;
    try { if (window.top && window.top.document) top = window.top.document; } catch (e) { /* cross-origin */ }
    walk(top);
    walk(document);
    return out;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype
      : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setTarget(cell, value) {
    if (!cell) return false;
    const inp = cell.querySelector ? cell.querySelector("input, textarea") : null;
    if (inp) { setNativeValue(inp, String(value)); return true; }
    cell.innerHTML = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
    try { cell.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* ignore */ }
    return true;
  }

  function findValueCell(label) {
    const target = norm(label);
    for (const d of allDocs()) {
      let cells;
      try { cells = d.querySelectorAll("td, th"); } catch (e) { continue; }
      for (const c of cells) {
        if (norm(c.innerText) === target) {
          const n = c.nextElementSibling;
          if (n) return n;
        }
      }
    }
    return null;
  }
  const fillByLabel = (label, value) => setTarget(findValueCell(label), value);

  // 같은 라벨이 여러 곳(상단 입력칸 + 문서 내 행)에 있으면 전부 채운다.
  function fillAllByLabel(label, value) {
    const target = norm(label);
    let any = false;
    for (const d of allDocs()) {
      let cells;
      try { cells = d.querySelectorAll("td, th"); } catch (e) { continue; }
      for (const c of cells) {
        if (norm(c.innerText) === target && c.nextElementSibling) {
          if (setTarget(c.nextElementSibling, value)) any = true;
        }
      }
    }
    return any;
  }

  function fillDetailTable(rows) {
    for (const d of allDocs()) {
      let trs;
      try { trs = [...d.querySelectorAll("tr")]; } catch (e) { continue; }
      const header = trs.find((tr) => {
        const t = norm(tr.innerText);
        return t.includes("계정과목") && t.includes("품목") && t.includes("거래처명");
      });
      if (!header) continue;
      const cols = header.cells ? header.cells.length : 5;
      // 헤더보다 문서상 뒤 + 내용이 빈 + 셀이 cols개 이상인 행 = 데이터행.
      const dataRows = trs.filter((tr) => {
        if (tr === header || !tr.cells || tr.cells.length < cols) return false;
        if (norm(tr.innerText) !== "") return false;
        try { return !!(header.compareDocumentPosition(tr) & 0x04 /* FOLLOWING */); }
        catch (e) { return true; }
      });
      if (!dataRows.length) {
        // 진단: 헤더 뒤 8개 행의 (셀수:앞6글자) 표시.
        const hIdx = trs.indexOf(header);
        const dbg = trs.slice(hIdx + 1, hIdx + 9)
          .map((tr) => `${tr.cells ? tr.cells.length : "?"}:${norm(tr.innerText).slice(0, 6) || "∅"}`)
          .join(" | ");
        return { ok: false, debug: `헤더셀=${cols} / 헤더뒤= ${dbg}` };
      }
      rows.forEach((r, i) => {
        const tr = dataRows[i];
        if (!tr) return;
        const tds = tr.cells;
        [r.계정과목, r.품목, r.금액, r.거래처명, r.수량].forEach((v, ci) => {
          if (tds[ci] != null && v != null) setTarget(tds[ci], v);
        });
      });
      return { ok: true, debug: "" };
    }
    return { ok: false, debug: "헤더(계정과목) 행을 못 찾음" };
  }

  function fill(data) {
    const done = [], miss = [];
    let detailDbg = "";
    const put = (k, ok) => (ok ? done : miss).push(k);
    if (data.제목 != null) put("제목", fillAllByLabel("제목", data.제목));
    for (const k of ["사용부서", "사용자", "직위", "발의금액", "지급일자"]) {
      if (data[k] != null) put(k, fillByLabel(k, data[k]));
    }
    if (Array.isArray(data.상세내역)) {
      const res = fillDetailTable(data.상세내역);
      put("상세내역", res.ok);
      if (!res.ok) detailDbg = res.debug;
    }
    if (data.합계 != null || data.발의금액 != null) fillByLabel("합계", data.합계 ?? data.발의금액);
    if (data.비고 != null) put("비고", fillByLabel("비고", data.비고));
    return { done, miss, detailDbg };
  }

  function doFill(jsonText) {
    let data;
    try { data = JSON.parse(jsonText); }
    catch { alert("JSON 파싱 실패 — 결재 탭의 [JSON 복사] 값을 그대로 붙여넣으세요."); return; }
    const { done, miss, detailDbg } = fill(data);
    alert(`시음주 결재 채우기 결과\n\n채움: ${done.join(", ") || "없음"}${miss.length ? "\n실패: " + miss.join(", ") : "\n(모두 채움)"}${detailDbg ? "\n\n[상세내역 진단]\n" + detailDbg : ""}`);
  }

  // 클립보드를 자동으로 읽어 바로 채움. 실패/무응답이면 1.5초 후 붙여넣기 창으로 전환.
  function runFill() {
    let settled = false;
    const askPaste = () => {
      if (settled) return; settled = true;
      const p = prompt("결재 JSON을 붙여넣으세요 ([JSON 복사] → Cmd+V):", "");
      if (p && p.trim()) doFill(p);
    };
    const useText = (txt) => {
      if (settled) return; settled = true;
      if (txt && txt.trim().charAt(0) === "{") doFill(txt); else askPaste();
    };
    let pr;
    try { pr = navigator.clipboard.readText(); } catch (e) { pr = null; }
    if (pr && pr.then) {
      pr.then(useText).catch(askPaste);
      setTimeout(askPaste, 1500); // 무응답(맥에서 멈춤) 대비
    } else {
      askPaste();
    }
  }

  // 넓은 프레임마다 버튼(잘 렌더되던 방식 그대로). 여러 개 떠도 아무거나 누르면 됨.
  function mountLocalButton() {
    if (!document.body) return false;
    if (document.getElementById("ta-fill-btn")) return true;
    if (window.innerWidth < 500 || window.innerHeight < 300) return false;
    const btn = document.createElement("button");
    btn.id = "ta-fill-btn";
    btn.type = "button";
    btn.textContent = "자동입력";
    btn.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:8px 18px;background:#fff;color:#333;border:1px solid #bbb;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.2);cursor:pointer;font:700 14px -apple-system,sans-serif";
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); runFill(); });
    document.body.appendChild(btn);
    return true;
  }

  // ── 인스펙터 ──
  let inspecting = false;
  function onInspectClick(e) {
    if (!inspecting) return;
    const el = e.target.closest("td, th, input, textarea");
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const prev = el.previousElementSibling;
    alert(`이 칸 text = "${(el.innerText || el.value || "").trim().slice(0, 30)}"\n옆(왼쪽) 라벨 = "${prev ? prev.innerText.trim().slice(0, 20) : ""}"`);
  }
  function attachInspector() {
    for (const d of allDocs()) {
      try { if (!d.__taInspect) { d.__taInspect = true; d.addEventListener("click", onInspectClick, true); } } catch (e) { /* ignore */ }
    }
  }

  // 단축키: Option(Alt)+Q → 채우기. 모든 프레임에 걸어 렌더링 문제와 무관하게 동작.
  function onKey(e) {
    if (e.altKey && (e.code === "KeyQ" || e.key === "q" || e.key === "Q")) {
      e.preventDefault(); e.stopPropagation();
      runFill();
    }
  }
  function attachKeys() {
    for (const d of allDocs()) {
      try { if (!d.__taKeys) { d.__taKeys = true; d.addEventListener("keydown", onKey, true); } } catch (e) { /* ignore */ }
    }
  }

  try {
    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("① 결재 자동 채우기", runFill);
      GM_registerMenuCommand("② 인스펙터 켜기/끄기", () => { inspecting = !inspecting; attachInspector(); alert(inspecting ? "인스펙터 ON — 칸 클릭" : "인스펙터 OFF"); });
    }
  } catch (e) { /* ignore */ }

  // eKP는 프레임만 갈아끼우며 페이지를 바꾸므로 계속 재점검(멈추지 않음).
  function tick() { attachInspector(); attachKeys(); mountLocalButton(); }
  tick();
  setInterval(tick, 1000);
})();
