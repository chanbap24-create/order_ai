"use client";

import { WINE_COLORS } from "../constants";

type Props = {
  data: any;
  needsClientPick: boolean;
};

/** API 에러 + 품목 없음 디버그 배너 */
export function ErrorBanners({ data, needsClientPick }: Props) {
  return (
    <>
      {data && !data.success && (
        <div
          style={{
            marginTop: 16,
            padding: "14px 18px",
            borderRadius: 12,
            background: WINE_COLORS.dangerBg,
            border: `1px solid ${WINE_COLORS.dangerBorder}`,
            color: WINE_COLORS.dangerStrong,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {data.error || "알 수 없는 오류가 발생했습니다."}
        </div>
      )}

      {data && !data.items && !needsClientPick && data.success && (
        <div
          style={{
            marginTop: 16,
            padding: "14px 18px",
            borderRadius: 12,
            background: WINE_COLORS.warningBg,
            border: `1px solid ${WINE_COLORS.warningBorder}`,
            color: WINE_COLORS.warningText,
            fontSize: 13,
          }}
        >
          API 응답은 성공했지만 품목이 없습니다. (status: {data.status || "없음"})
        </div>
      )}
    </>
  );
}
