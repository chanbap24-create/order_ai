'use client';

import { useEffect, useState } from 'react';
import type { SalesTabId } from '../../components/SalesTabs';
import { clearAuthHint, readAuthHint, saveAuthHint } from '../lib/authHint';

function computeIsAdmin(role: string, department: string) {
  // sales_admin = 사무업무 처리용. 영업 전체 데이터 조회 권한이 필요해 isAdmin 으로 취급.
  return role === 'admin' || role === 'executive' || role === 'sales_admin' || department === '마케팅부';
}

export function useSalesAuth(setActiveTab: (t: SalesTabId) => void) {
  const hint = typeof window !== 'undefined' ? readAuthHint() : null;
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(!!hint?.authenticated);
  const [currentManager, setCurrentManager] = useState(hint?.manager || '');
  const [isAdmin, setIsAdmin] = useState(
    hint ? computeIsAdmin(hint.role, hint.department) : false,
  );
  const [userRole, setUserRole] = useState('');
  const [userDepartment, setUserDepartment] = useState('');
  const [managerList, setManagerList] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem('sales_managers_cache') : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { value: string[]; at: number };
        if (parsed && Date.now() - parsed.at < 30 * 60 * 1000 && Array.isArray(parsed.value)) {
          setManagerList(parsed.value);
        }
      }
    } catch { /* ignore */ }

    const authP = fetch('/api/auth/me').then(r => r.json()).catch(() => null);
    const mgrP = fetch('/api/sales/clients/managers').then(r => r.json()).catch(() => null);
    Promise.all([authP, mgrP]).then(([authData, mgrData]) => {
      if (authData?.authenticated) {
        setAuthenticated(true);
        setCurrentManager(authData.manager);
        setIsAdmin(computeIsAdmin(authData.role || '', authData.department || ''));
        setUserRole(authData.role || '');
        setUserDepartment(authData.department || '');
        if (authData.role === 'executive') setActiveTab('analysis');
        saveAuthHint({
          authenticated: true,
          manager: authData.manager,
          role: authData.role || '',
          department: authData.department || '',
        });
      } else {
        setAuthenticated(false);
        clearAuthHint();
      }
      if (mgrData?.managers) {
        setManagerList(mgrData.managers);
        try {
          sessionStorage.setItem('sales_managers_cache', JSON.stringify({ value: mgrData.managers, at: Date.now() }));
        } catch { /* ignore */ }
      }
      setAuthChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptLogin = (data: { manager: string; role?: string; department?: string }) => {
    saveAuthHint({
      authenticated: true,
      manager: data.manager,
      role: data.role || '',
      department: data.department || '',
    });
    // 로그인 직후 전체 리로드로 Next.js 라우터 캐시를 초기화한다.
    // 비로그인 상태에서 보호 페이지(/inventory, /order-v2 등) 링크가 prefetch 되면
    // 미들웨어가 /sales 로 redirect 한 응답이 라우터 캐시에 박혀서, 로그인 후에도
    // 메뉴를 눌러도 /sales 만 열리는 증상이 생긴다(새로고침하면 해소).
    // authHint 를 먼저 저장하므로 리로드 후 로그인 화면 깜빡임 없이 인증 상태로 진입한다.
    if (typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    // SSR 안전망: window 가 없으면 기존처럼 state 만 갱신
    setAuthenticated(true);
    setCurrentManager(data.manager);
    setIsAdmin(computeIsAdmin(data.role || '', data.department || ''));
    setUserRole(data.role || '');
    setUserDepartment(data.department || '');
    if (data.role === 'executive') setActiveTab('analysis');
  };

  const logoutLocal = () => {
    clearAuthHint();
    setAuthenticated(false);
    setCurrentManager('');
    setIsAdmin(false);
    setUserRole('');
    setUserDepartment('');
    setActiveTab('meetings');
  };

  return {
    authChecking, authenticated,
    currentManager, isAdmin, userRole, userDepartment,
    managerList,
    acceptLogin, logoutLocal,
  };
}
