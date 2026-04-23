export type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UploadCardState {
  status: UploadStatus;
  fileName: string;
  message: string;
  isDragOver: boolean;
}

export type UploadMode = "append" | "replace";

export type DetectedType =
  | "downloads"
  | "dl"
  | "client"
  | "dl-client"
  | "payments"
  | "dl-payments"
  | "unknown";

export interface BatchFile {
  file: File;
  detectedType: DetectedType;
  confidence: "high" | "medium" | "low";
  reason: string;
  overrideType?: DetectedType;
  status: "pending" | "uploading" | "success" | "error";
  message?: string;
}

export interface DownloadLog {
  type:
    | "start"
    | "progress"
    | "info"
    | "success"
    | "fail"
    | "error"
    | "summary"
    | "done";
  message: string;
  files?: string[];
  code?: number;
}

export interface UploadAreaDef {
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly icon: React.ReactNode;
}
