export interface AuthHintValue {
  authenticated: boolean;
  manager: string;
  role: string;
  department: string;
}

interface StoredHint extends AuthHintValue { at: number }

const STORAGE_KEY = 'sales_auth_hint';
const TTL_MS = 24 * 60 * 60 * 1000;

export function readAuthHint(): AuthHintValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHint;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthHint(v: AuthHintValue) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...v, at: Date.now() }));
  } catch { /* ignore */ }
}

export function clearAuthHint() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
