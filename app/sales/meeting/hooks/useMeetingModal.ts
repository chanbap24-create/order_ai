import { useState } from "react";
import type { ClientOption, Meeting } from "../types";
import { buildGoogleCalendarUrl } from "../lib/googleCalendar";
import { formatDate } from "../lib/format";
import { useClientSearch } from "./useClientSearch";

type Params = {
  currentManager: string;
  filterManager: string;
  loadMeetings: () => void;
  setToast: (t: string) => void;
  setPendingCalUrl: (u: string) => void;
  /** 첫 미팅 생성 시 Notification 권한 요청 트리거 */
  onFirstSave?: () => void;
};

/**
 * 미팅 생성/수정 모달 state + saveMeeting/deleteMeeting/openEditModal 등.
 */
export function useMeetingModal(p: Params) {
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState("");
  const [modalTime, setModalTime] = useState("10:00");
  const [modalType, setModalType] = useState("visit");
  const [modalTitle, setModalTitle] = useState("");
  const [modalPurpose, setModalPurpose] = useState("");
  const [modalClient, setModalClient] = useState<ClientOption | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCode, setNewClientCode] = useState("");
  const [newClientCodeError, setNewClientCodeError] = useState("");
  const [modalReminder, setModalReminder] = useState<number | null>(null);

  const clientSearch = useClientSearch(p.filterManager);

  const openCreateModal = (date?: string) => {
    // 첫 모달 오픈 시점에 거래처 목록 프리로드 (500개 payload 지연 로드)
    clientSearch.ensureLoaded();
    setEditingId(null);
    setModalDate(date || formatDate(new Date()));
    setModalTime("10:00");
    setModalType("visit");
    setModalTitle("");
    setModalPurpose("");
    setModalClient(null);
    clientSearch.setSearch("");
    setNewClientMode(false);
    setNewClientName("");
    setNewClientCode("");
    setModalReminder(null);
    setShowModal(true);
  };

  const openEditModal = (m: Meeting) => {
    clientSearch.ensureLoaded();
    setEditingId(m.id);
    setModalDate(m.meeting_date?.slice(0, 10) || formatDate(new Date()));
    setModalTime(m.meeting_time || "10:00");
    setModalType(m.meeting_type || "visit");
    const parts = (m.purpose || "").split(" - ");
    setModalTitle(parts[0] || "");
    setModalPurpose(parts.slice(1).join(" - ") || "");
    setModalClient(
      m.client_code ? { client_code: m.client_code, client_name: m.client_name } : null,
    );
    clientSearch.setSearch(m.client_name || "");
    setNewClientMode(false);
    setNewClientName("");
    setNewClientCode("");
    setModalReminder(m.reminder_minutes ?? null);
    setShowModal(true);
  };

  const saveMeeting = async () => {
    // 첫 저장 시 Notification 권한 요청 (사용자 상호작용 시점)
    p.onFirstSave?.();
    let clientToUse = modalClient;

    if (newClientMode) {
      if (!newClientName.trim()) {
        p.setToast("거래처명을 입력해주세요.");
        return;
      }
      const code = newClientCode.trim() || `NEW_${Date.now()}`;
      setModalSaving(true);
      try {
        const createRes = await fetch("/api/sales/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_code: code,
            client_name: newClientName.trim(),
            client_type: "wine",
            manager: p.currentManager || "",
          }),
        });
        const createJson = await createRes.json();
        if (createJson.error) {
          p.setToast("거래처 등록 실패: " + createJson.error);
          setModalSaving(false);
          return;
        }
        clientToUse = { client_code: code, client_name: newClientName.trim() };
      } catch {
        p.setToast("거래처 등록에 실패했습니다.");
        setModalSaving(false);
        return;
      }
    }

    setModalSaving(true);
    try {
      const purposeStr =
        [modalTitle.trim(), modalPurpose.trim()].filter(Boolean).join(" - ") || null;
      const body: Record<string, unknown> = {
        client_code: clientToUse?.client_code || null,
        meeting_date: modalDate,
        meeting_time: modalTime,
        meeting_type: modalType,
        purpose: purposeStr,
        reminder_minutes: modalReminder,
        manager: p.currentManager || "",
      };
      if (editingId) body.id = editingId;

      const res = await fetch("/api/sales/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) {
        p.setToast("오류: " + json.error);
        return;
      }
      setShowModal(false);
      if (!editingId) {
        const calUrl = buildGoogleCalendarUrl({
          meeting_date: modalDate,
          meeting_time: modalTime,
          meeting_type: modalType,
          purpose: purposeStr,
          status: "planned",
          client_name: clientToUse?.client_name || modalTitle.trim() || "일정",
        } as Meeting);
        p.setPendingCalUrl(calUrl);
      }
      p.setToast(editingId ? "미팅이 수정되었습니다." : "미팅이 생성되었습니다.");
      p.loadMeetings();
    } catch {
      p.setToast("저장에 실패했습니다.");
    } finally {
      setModalSaving(false);
    }
  };

  const deleteMeeting = async (id: number) => {
    if (!confirm("이 미팅을 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/sales/meetings?id=${id}`, { method: "DELETE" });
      p.setToast("미팅이 삭제되었습니다.");
      p.loadMeetings();
    } catch {
      p.setToast("삭제에 실패했습니다.");
    }
  };

  return {
    showModal, setShowModal,
    modalDate, setModalDate,
    modalTime, setModalTime,
    modalType, setModalType,
    modalTitle, setModalTitle,
    modalPurpose, setModalPurpose,
    modalClient, setModalClient,
    modalSaving,
    editingId,
    newClientMode, setNewClientMode,
    newClientName, setNewClientName,
    newClientCode, setNewClientCode,
    newClientCodeError, setNewClientCodeError,
    modalReminder, setModalReminder,
    clientSearch,
    openCreateModal,
    openEditModal,
    saveMeeting,
    deleteMeeting,
  };
}
