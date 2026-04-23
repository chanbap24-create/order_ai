import type { DetectedType, UploadAreaDef } from "./types";

export const ACCEPT = ".xlsx,.xls,.csv";

export const UPLOAD_LABELS: Record<string, string> = {
  client: "거래처별 와인 출고현황",
  "dl-client": "거래처별 글라스 출고현황",
  riedel: "리델리스트",
  downloads: "와인재고현황",
  dl: "글라스재고현황",
  english: "와인리스트",
  payments: "수금내역(Wine)",
  "dl-payments": "수금내역(DL)",
  "import-schedule": "수입일정",
};

export const FILE_KEY_MAP: Record<string, string> = {
  "cdv-release": "client",
  "cdv-stock": "downloads",
  "cdv-payment": "payments",
  "dl-release": "dl-client",
  "dl-stock": "dl",
  "dl-payment": "dl-payments",
};

export const FILE_LABEL_MAP: Record<string, string> = {
  "cdv-release": "와인 출고현황",
  "cdv-stock": "와인 재고현황",
  "cdv-payment": "수금내역(Wine)",
  "dl-release": "글라스 출고현황",
  "dl-stock": "글라스 재고현황",
  "dl-payment": "수금내역(DL)",
};

export const BATCH_TYPE_OPTIONS: { value: DetectedType; label: string }[] = [
  { value: "downloads", label: "와인재고현황" },
  { value: "dl", label: "글라스재고현황" },
  { value: "client", label: "와인 출고현황" },
  { value: "dl-client", label: "글라스 출고현황" },
  { value: "payments", label: "수금내역(Wine)" },
  { value: "dl-payments", label: "수금내역(DL)" },
];

const STROKE = "var(--color-primary)";
const SVG = (d: React.ReactNode) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const UPLOAD_AREAS: readonly UploadAreaDef[] = [
  {
    type: "client",
    label: "거래처별 와인 출고현황",
    description: "Client 시트 데이터",
    icon: SVG(<>
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="10" y1="2" x2="10" y2="8" />
      <line x1="14" y1="2" x2="14" y2="8" />
      <path d="M10 8 L8 10" />
      <path d="M14 8 L16 10" />
      <line x1="8" y1="10" x2="8" y2="20" />
      <line x1="16" y1="10" x2="16" y2="20" />
      <path d="M8 20 L8 21 L16 21 L16 20" />
      <path d="M9 14 L15 14" opacity="0.5" />
    </>),
  },
  {
    type: "dl-client",
    label: "거래처별 글라스 출고현황",
    description: "DL-Client 시트 데이터",
    icon: SVG(<>
      <line x1="6" y1="3" x2="18" y2="3" />
      <path d="M7 3 L7 8 C7 10 8.5 12 12 12 C15.5 12 17 10 17 8 L17 3" />
      <line x1="12" y1="12" x2="12" y2="19" />
      <line x1="9" y1="19" x2="15" y2="19" />
      <path d="M9 19 L9 20 L15 20 L15 19" />
    </>),
  },
  {
    type: "payments",
    label: "수금내역(Wine)",
    description: "와인 거래처별 수금 입금 내역",
    icon: SVG(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>),
  },
  {
    type: "dl-payments",
    label: "수금내역(DL)",
    description: "DL(RIEDEL) 거래처별 수금 입금 내역",
    icon: SVG(<>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="19" cy="5" r="4" fill={STROKE} stroke="none" opacity="0.3" />
    </>),
  },
  {
    type: "downloads",
    label: "와인재고현황",
    description: "와인 재고 현황 데이터",
    icon: SVG(<>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>),
  },
  {
    type: "dl",
    label: "글라스재고현황",
    description: "글라스 재고 현황 데이터",
    icon: SVG(<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />),
  },
  {
    type: "english",
    label: "와인리스트",
    description: "와인 영문/한글 가격 리스트",
    icon: SVG(<>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>),
  },
  {
    type: "riedel",
    label: "리델리스트",
    description: "리델 가격 리스트",
    icon: SVG(<>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </>),
  },
  {
    type: "import-schedule",
    label: "수입일정",
    description: "CDV 미착 품목 수입 일정",
    icon: SVG(<>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M12 14l-3 3h6l-3-3z" fill={STROKE} opacity="0.3" />
    </>),
  },
] as const;
