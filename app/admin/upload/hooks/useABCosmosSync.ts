import { useEffect, useRef, useState } from "react";
import type { DownloadLog, UploadMode } from "../types";
import { FILE_KEY_MAP, FILE_LABEL_MAP } from "../constants";

type Phase = "idle" | "downloading" | "uploading" | "done";

type Params = {
  handleUpload: (type: string, file: File, mode?: UploadMode) => Promise<void>;
  checkStatus: () => void;
};

/** ABCosmos ERP 자동 다운로드 + DB 업로드 파이프라인 */
export function useABCosmosSync({ handleUpload, checkStatus }: Params) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<DownloadLog[]>([]);
  const [expanded, setExpanded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (log: DownloadLog) => setLogs((prev) => [...prev, log]);

  const readStream = async (res: Response, onData: (data: DownloadLog) => void) => {
    if (!res.body) throw new Error("스트림을 열 수 없습니다.");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          onData(JSON.parse(line.slice(6)) as DownloadLog);
        } catch {
          /* skip */
        }
      }
    }
  };

  const startSync = async (mode = "all") => {
    setPhase("downloading");
    setLogs([]);
    setExpanded(true);

    let files: string[] = [];

    try {
      const res = await fetch(`/api/admin/auto-download?mode=${mode}`);
      await readStream(res, (data) => {
        addLog(data);
        if (data.type === "done" && data.files) files = data.files;
      });
    } catch (err) {
      addLog({ type: "error", message: err instanceof Error ? err.message : "알 수 없는 에러" });
      setPhase("done");
      return;
    }

    if (files.length === 0) {
      addLog({ type: "error", message: "다운로드된 파일이 없습니다." });
      setPhase("done");
      return;
    }

    setPhase("uploading");
    addLog({ type: "summary", message: `\n═══ DB 업로드 시작 (${files.length}개) ═══` });

    let uploadSuccess = 0;
    for (const fileName of files) {
      const key = fileName.replace(/_\d+\.xlsx$/, "");
      const uploadType = FILE_KEY_MAP[key];
      if (!uploadType) continue;

      try {
        addLog({ type: "info", message: `업로드: ${FILE_LABEL_MAP[key] || key}...` });
        const res = await fetch("/api/admin/auto-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName }),
        });
        if (!res.ok) throw new Error("파일 가져오기 실패");

        const blob = await res.blob();
        const file = new File([blob], fileName, { type: blob.type });
        // 일괄 동기화는 누적 모드 강제 (이전 월 데이터 보호)
        await handleUpload(uploadType, file, "append");
        addLog({ type: "success", message: `✓ ${FILE_LABEL_MAP[key]} DB 반영 완료` });
        uploadSuccess++;
      } catch (err) {
        addLog({
          type: "fail",
          message: `✗ ${FILE_LABEL_MAP[key]} 업로드 실패: ${err instanceof Error ? err.message : ""}`,
        });
      }
    }

    addLog({ type: "summary", message: `\n═══ 동기화 완료: ${uploadSuccess}/${files.length} 성공 ═══` });
    checkStatus();
    setPhase("done");
  };

  const startDownloadOnly = async (mode = "all") => {
    setPhase("downloading");
    setLogs([]);
    setExpanded(true);

    try {
      const res = await fetch(`/api/admin/auto-download?mode=${mode}`);
      await readStream(res, addLog);
    } catch (err) {
      addLog({ type: "error", message: err instanceof Error ? err.message : "알 수 없는 에러" });
    } finally {
      setPhase("done");
    }
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const isBusy = phase === "downloading" || phase === "uploading";
  const successCount = logs.filter((l) => l.type === "success").length;
  const failCount = logs.filter((l) => l.type === "fail" || l.type === "error").length;
  const phaseLabel =
    phase === "downloading" ? "ERP 다운로드 중..." : phase === "uploading" ? "DB 업로드 중..." : "";

  return {
    phase,
    logs,
    logRef,
    expanded,
    setExpanded,
    isBusy,
    successCount,
    failCount,
    phaseLabel,
    startSync,
    startDownloadOnly,
  };
}
