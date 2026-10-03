'use client';

// 테이스팅노트 탭 상단 — 매장 직원이 요청한 테이스팅 노트(미처리). 와인명 탭 = 그 와인 열기, '완료' = 요청 처리.
// 와인리스트(wines)에 없는 품번(예: DL 재고에만 있는 타사 ZK)은 목록에 안 나오므로 '등록' 버튼으로 바로 등록.
// 요청이 없으면 아무것도 그리지 않는다.
import type { ChangeRequest } from '@/app/lib/sommelierRequestTypes';
import { storeViewLabel, type StoreView } from '@/app/lib/store/types';

const when = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ').replace('-', '.');

export function NoteRequestStrip({ requests, hasNote, inList, onOpen, onRegister, onResolve }: {
  requests: ChangeRequest[];
  hasNote: (itemNo: string) => boolean;   // 이미 노트가 있으면 '노트 있음' 표시(완료 처리 안내)
  inList: (itemNo: string) => boolean;    // 와인리스트에 등록된 품번인가
  onRegister: (r: ChangeRequest) => void; // 미등록 품번 → 와인리스트에 등록
  onOpen: (r: ChangeRequest) => void;
  onResolve: (id: number) => void;
}) {
  if (!requests.length) return null;
  return (
    <div style={{ margin: '8px 0 10px', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>노트 요청</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-warning)', fontVariantNumeric: 'tabular-nums' }}>{requests.length}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>매장에서 테이스팅 노트를 요청한 와인</span>
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {requests.map((r) => {
          const done = hasNote(r.item_no);
          const missing = !inList(r.item_no);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 2px', borderBottom: '1px solid var(--border-subtle)', minWidth: 0 }}>
              <span style={{ flex: 'none', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{r.item_no}</span>
              <button type="button" onClick={() => onOpen(r)} title="이 와인 열기"
                style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.item_name_kr || r.item_name_en || r.item_no}
                {r.message && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-secondary)' }}>“{r.message}”</span>}
              </button>
              {done && (
                <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--status-success)' }}>
                  <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)' }} />노트 있음
                </span>
              )}
              {missing && (
                <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--status-warning)' }}>
                  와인리스트 미등록
                  <button type="button" onClick={() => onRegister(r)}
                    style={{ all: 'unset', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    등록
                  </button>
                </span>
              )}
              <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {r.requester}{r.store_key ? ` · ${storeViewLabel(r.store_key as StoreView)}` : ''} · {when(r.created_at)}
              </span>
              <button type="button" onClick={() => onResolve(r.id)}
                style={{ all: 'unset', cursor: 'pointer', flex: 'none', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                완료
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
