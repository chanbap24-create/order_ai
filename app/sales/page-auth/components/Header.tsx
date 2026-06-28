'use client';

import { PageHeader } from '@/app/components/ui';
import { WineListExportMenu } from './WineListExportMenu';

type Props = {
  currentManager: string;
  isAdmin: boolean;
  showPwChange: boolean;
  onTogglePwChange: () => void;
  onLogout: () => void;
};

/**
 * Sales 페이지 헤더 — PageHeader primitive 사용으로 다른 페이지와 시각 통일.
 * 기존 인라인 스타일 버튼은 design-system 의 의미 토큰을 사용하는 작은 액션 버튼으로 정리.
 */
export function Header({ currentManager, isAdmin, showPwChange, onTogglePwChange, onLogout }: Props) {
  return (
    <PageHeader
      title="Sales"
      actions={
        <>
          <WineListExportMenu />
          <HeaderActionButton active={showPwChange} onClick={onTogglePwChange}>
            PW
          </HeaderActionButton>
          <HeaderActionButton onClick={onLogout}>로그아웃</HeaderActionButton>
        </>
      }
    />
  );
}

function HeaderActionButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-default)'}`,
        background: active ? 'var(--surface-hover)' : 'transparent',
        fontSize: 11,
        fontWeight: 600,
        color: active ? 'var(--action)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
