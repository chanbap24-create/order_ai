'use client';

import type { ClientGroup } from '../hooks/useClientGroups';

type Props = {
  groups: ClientGroup[];
  activeId: number | null;
  pickedCount: number;
  onPickGroup: (g: ClientGroup) => void;   // 그룹 선택 → 구성원 체크 + 목록 필터
  onClearGroup: () => void;                // 전체(그룹 해제)
  onSaveNew: () => void;                   // 현재 선택으로 새 그룹
  onAddToGroup: (id: number) => void;      // 현재 선택을 기존 그룹에 추가(합집합)
  onUpdateActive: () => void;              // 활성 그룹을 현재 선택으로 갱신
  onRenameActive: () => void;
  onDeleteActive: () => void;
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${active ? 'var(--action)' : 'var(--gray-300)'}`,
  background: active ? 'var(--action)' : '#fff',
  color: active ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap',
});
const act: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--gray-300)', background: '#fff', color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
};

/** 거래처 그룹(즐겨찾기) 바 — 그룹 칩 선택 시 구성원 자동 체크, 바로 일괄 견적 가능. */
export function ClientGroupBar({
  groups, activeId, pickedCount,
  onPickGroup, onClearGroup, onSaveNew, onAddToGroup, onUpdateActive, onRenameActive, onDeleteActive,
}: Props) {
  const active = groups.find((g) => g.id === activeId) || null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      background: '#fff', border: '1px solid var(--border-default)', borderRadius: 12,
      padding: '10px 14px',
    }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
        그룹
      </span>
      <button onClick={onClearGroup} style={chip(activeId === null)}>전체</button>
      {groups.map((g) => (
        <button key={g.id} onClick={() => onPickGroup(g)} style={chip(activeId === g.id)}>
          {g.name} <span style={{ fontWeight: 400, opacity: 0.75 }}>{g.clients.length}</span>
        </button>
      ))}

      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
        {pickedCount > 0 && groups.length > 0 && (
          <select
            value=""
            onChange={(e) => { const id = Number(e.target.value); if (id) onAddToGroup(id); e.target.value = ''; }}
            title="체크된 거래처를 선택한 그룹에 추가(기존 구성원 유지)"
            style={{ ...act, padding: '4px 8px', appearance: 'auto' as never }}
          >
            <option value="">선택 {pickedCount}곳을 그룹에 추가…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.clients.length})</option>
            ))}
          </select>
        )}
        {pickedCount > 0 && (
          <button onClick={onSaveNew} style={act}>＋ 새 그룹으로</button>
        )}
        {active && pickedCount > 0 && (
          <button onClick={onUpdateActive} style={act} title="이 그룹의 구성원을 현재 체크된 거래처로 교체">
            &lsquo;{active.name}&rsquo; 갱신
          </button>
        )}
        {active && (
          <>
            <button onClick={onRenameActive} style={act}>이름변경</button>
            <button onClick={onDeleteActive} style={{ ...act, color: 'var(--status-danger)' }}>삭제</button>
          </>
        )}
      </span>
    </div>
  );
}
