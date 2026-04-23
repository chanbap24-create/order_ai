'use client';

import { useUploadTab } from '../upload/hooks/useUploadTab';
import { UPLOAD_AREAS } from '../upload/constants';
import { DBStatusCard } from '../upload/components/DBStatusCard';
import { ABCosmosAutoDownload } from '../upload/components/ABCosmosAutoDownload';
import { SmartBatchUpload } from '../upload/components/SmartBatchUpload';
import { UploadCard } from '../upload/components/UploadCard';

interface UploadTabProps {
  onUploadComplete?: (type: string, result: Record<string, unknown>) => void;
}

export default function UploadTab({ onUploadComplete }: UploadTabProps) {
  const s = useUploadTab({ onUploadComplete });

  return (
    <div>
      <DBStatusCard
        statusResult={s.statusResult}
        statusError={s.statusError}
        isChecking={s.isChecking}
        onRefresh={s.checkStatus}
      />

      <ABCosmosAutoDownload handleUpload={s.handleUpload} checkStatus={s.checkStatus} />

      <SmartBatchUpload handleUpload={s.handleUpload} checkStatus={s.checkStatus} />

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          개별 업로드
        </h2>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-light)',
            marginBottom: 'var(--space-4)',
          }}
        >
          각 시트별 엑셀 파일을 개별 업로드합니다.
        </p>
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            fontSize: 'var(--text-sm)',
            color: '#7C6800',
            marginBottom: 'var(--space-5)',
          }}
        >
          출고현황(Client/DL-Client)과 수금내역(Wine/DL)은 누적 추가/전체 교체 모드를 선택할 수 있습니다.
          그 외 시트는 업로드 시 기존 데이터가 교체됩니다.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 'var(--space-5)',
          alignItems: 'stretch',
        }}
      >
        {UPLOAD_AREAS.map((area) => {
          const hasMode =
            area.type === 'client' ||
            area.type === 'dl-client' ||
            area.type === 'payments' ||
            area.type === 'dl-payments';
          const lastDate =
            area.type === 'client' || area.type === 'dl-client'
              ? s.shipmentLastDates[area.type]
              : area.type === 'payments' || area.type === 'dl-payments'
                ? s.paymentLastDates[area.type]
                : area.type === 'downloads' || area.type === 'dl'
                  ? s.inventoryLastDates[area.type]
                  : undefined;
          return (
            <UploadCard
              key={area.type}
              area={area}
              state={s.cards[area.type]}
              onUpload={s.handleUpload}
              onDragState={(over) => s.updateCard(area.type, { isDragOver: over })}
              uploadMode={hasMode ? s.uploadMode[area.type] : undefined}
              onModeChange={
                hasMode
                  ? (mode) => s.setUploadMode((prev) => ({ ...prev, [area.type]: mode }))
                  : undefined
              }
              lastDate={lastDate}
            />
          );
        })}
      </div>
    </div>
  );
}
