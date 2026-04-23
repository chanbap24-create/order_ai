import { useState } from "react";
import type { BriefingData, Meeting } from "../types";

type Params = {
  loadMeetings: () => void;
  setToast: (t: string) => void;
};

/**
 * 미팅 상세 패널 + 브리핑 + 견적서 생성 관련 state/handlers.
 */
export function useMeetingDetail(p: Params) {
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [detailNotes, setDetailNotes] = useState("");

  const openDetail = (m: Meeting) => {
    setDetailMeeting(m);
    setDetailNotes(m.notes || "");
    if (m.ai_briefing) {
      setBriefing(m.ai_briefing as BriefingData);
      const autoSelect = new Set<string>();
      (m.ai_briefing?.recommendations || [])
        .slice(0, 5)
        .forEach((r: { item_no: string }) => autoSelect.add(r.item_no));
      setSelectedRecs(autoSelect);
    } else {
      setBriefing(null);
      setSelectedRecs(new Set());
    }
  };

  const closeDetail = () => {
    setDetailMeeting(null);
    setBriefing(null);
  };

  const changeStatus = async (meeting: Meeting, newStatus: string) => {
    try {
      const res = await fetch("/api/sales/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: meeting.id,
          status: newStatus,
          notes: detailNotes || meeting.notes,
        }),
      });
      const json = await res.json();
      if (json.error) {
        p.setToast("오류: " + json.error);
        return;
      }
      p.setToast(`상태가 변경되었습니다.`);
      p.loadMeetings();
      if (detailMeeting?.id === meeting.id) {
        setDetailMeeting({ ...detailMeeting, status: newStatus });
      }
    } catch {
      p.setToast("상태 변경에 실패했습니다.");
    }
  };

  const generateBriefing = async (meeting: Meeting) => {
    setBriefingLoading(true);
    setBriefing(null);
    setSelectedRecs(new Set());
    try {
      const res = await fetch("/api/sales/meetings/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: meeting.id, client_code: meeting.client_code }),
      });
      const json = await res.json();
      if (json.error) {
        p.setToast("브리핑 생성 실패: " + json.error);
        return;
      }
      setBriefing(json.briefing);
      const autoSelect = new Set<string>();
      (json.briefing?.recommendations || [])
        .slice(0, 5)
        .forEach((r: { item_no: string }) => autoSelect.add(r.item_no));
      setSelectedRecs(autoSelect);
    } catch {
      p.setToast("브리핑 생성에 실패했습니다.");
    } finally {
      setBriefingLoading(false);
    }
  };

  const createQuote = async (quoteCols: string[]) => {
    if (!briefing || selectedRecs.size === 0) return;
    setQuoteLoading(true);
    try {
      const items = briefing.recommendations.filter((r) => selectedRecs.has(r.item_no));
      const res = await fetch("/api/sales/recommend/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          client_code: detailMeeting?.client_code,
          client_name: detailMeeting?.client_name,
          clear_existing: true,
        }),
      });
      const json = await res.json();
      if (json.error) {
        p.setToast("오류: " + json.error);
        return;
      }
      const params = new URLSearchParams();
      params.set("columns", JSON.stringify(quoteCols));
      if (detailMeeting?.client_name) params.set("client_name", detailMeeting.client_name);
      window.location.href = `/api/quote/export?${params}`;
      p.setToast(`${json.added_count}개 와인 견적서 생성 완료`);
    } catch {
      p.setToast("견적서 생성에 실패했습니다.");
    } finally {
      setQuoteLoading(false);
    }
  };

  const toggleRec = (itemNo: string) => {
    setSelectedRecs((prev) => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo);
      else next.add(itemNo);
      return next;
    });
  };

  return {
    detailMeeting, setDetailMeeting,
    briefing, briefingLoading,
    selectedRecs, toggleRec,
    quoteLoading,
    detailNotes, setDetailNotes,
    openDetail, closeDetail,
    changeStatus, generateBriefing, createQuote,
  };
}
