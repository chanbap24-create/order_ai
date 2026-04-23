'use client';

import { useEffect, useState } from 'react';
import type { SalesTabId } from '../../components/SalesTabs';
import { clearAuthHint, readAuthHint, saveAuthHint } from '../lib/authHint';

function computeIsAdmin(role: string, department: string) {
  return role === 'admin' || role === 'executive' || department === '마케팅부';
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
    setAuthenticated(true);
    setCurrentManager(data.manager);
    setIsAdmin(computeIsAdmin(data.role || '', data.department || ''));
    setUserRole(data.role || '');
    setUserDepartment(data.department || '');
    if (data.role === 'executive') setActiveTab('analysis');
    saveAuthHint({
      authenticated: true,
      manager: data.manager,
      role: data.role || '',
      department: data.department || '',
    });
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
