'use client';

import type { WineRowExt } from '../types';
import { DetailPanel } from './DetailPanel';

type Props = {
  isMobile: boolean;
  selectedWine: WineRowExt | null;
  onClose: () => void;
  editFields: Record<string, string>;
  setEditFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSaveField: (dbKey: string) => void;
  savingField: string;
  handleDeleteSingle: (id: string, name: string) => Promise<void>;
  deleting: boolean;
  onRefresh?: () => void;
};

export function DetailContainer(p: Props) {
  if (p.isMobile) {
    if (!p.selectedWine) return null;
    return (
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000,
          background: 'rgba(90,21,21,0.4)',
          display: 'flex', justifyContent: 'flex-end',
        }}
        onClick={p.onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 400, background: '#fff', overflowY: 'auto',
            animation: 'slideInRight 0.25s ease',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0,
            background: '#fff', zIndex: 1,
          }}>
            <button
              onClick={p.onClose}
              style={{
                border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 14,
                color: 'var(--action)', fontWeight: 600, padding: '6px 14px', borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              목록으로
            </button>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{p.selectedWine.item_code}</span>
          </div>
          <DetailPanel
            selectedWine={p.selectedWine}
            editFields={p.editFields}
            setEditFields={p.setEditFields}
            handleSaveField={p.handleSaveField}
            savingField={p.savingField}
            handleDeleteSingle={p.handleDeleteSingle}
            deleting={p.deleting}
            onRefresh={p.onRefresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 380, minWidth: 320, overflowY: 'auto', background: '#fff',
      borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0,
    }}>
      {!p.selectedWine ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
          좌측에서 와인을 선택하세요
        </div>
      ) : (
        <DetailPanel
          selectedWine={p.selectedWine}
          editFields={p.editFields}
          setEditFields={p.setEditFields}
          handleSaveField={p.handleSaveField}
          savingField={p.savingField}
          handleDeleteSingle={p.handleDeleteSingle}
          deleting={p.deleting}
          onRefresh={p.onRefresh}
        />
      )}
    </div>
  );
}
