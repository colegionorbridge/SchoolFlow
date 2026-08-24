import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const API = import.meta.env.VITE_API_URL || '';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

interface AuthState {
  telefono: string;
  nombre: string;
  token: string;
  esAdmin: boolean;
  superAdmin?: boolean;
}

interface AdminInfo { id: string; nombre: string; }

interface AuthCtx {
  user: AuthState | null;
  fetchAdmins: () => Promise<AdminInfo[]>;
  login: (id: string) => Promise<string>;
  verify: (id: string, codigo: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem('norbridge_auth');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data._ts > INACTIVITY_TIMEOUT) {
      localStorage.removeItem('norbridge_auth');
      return null;
    }
    data._ts = Date.now();
    localStorage.setItem('norbridge_auth', JSON.stringify(data));
    return data;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(loadAuth);
  const [loading, setLoading] = useState(false);

  const fetchAdmins = useCallback(async (): Promise<AdminInfo[]> => {
    const res = await fetch(`${API}/api/auth/admins`);
    if (!res.ok) return [];
    return res.json();
  }, []);

  const login = useCallback(async (id: string): Promise<string> => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/solicitar-codigo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al solicitar código');
      return data.message || 'Código enviado';
    } finally { setLoading(false); }
  }, []);

  const verify = useCallback(async (id: string, codigo: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verificar-codigo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: id, codigo }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Código inválido');
      const data = await res.json();
      const session: AuthState = { telefono: id, token: data.token, nombre: data.nombre || '', esAdmin: data.esAdmin, superAdmin: data.superAdmin, _ts: Date.now() } as any;
      localStorage.setItem('norbridge_auth', JSON.stringify(session));
      setUser(session);
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('norbridge_auth');
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const bumpTs = () => {
      const raw = localStorage.getItem('norbridge_auth');
      if (raw) {
        const data = JSON.parse(raw);
        data._ts = Date.now();
        localStorage.setItem('norbridge_auth', JSON.stringify(data));
      }
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, bumpTs));
    const interval = setInterval(() => {
      const raw = localStorage.getItem('norbridge_auth');
      if (!raw) { logout(); return; }
      const data = JSON.parse(raw);
      if (Date.now() - data._ts > INACTIVITY_TIMEOUT) logout();
    }, 10000);
    return () => {
      events.forEach(e => window.removeEventListener(e, bumpTs));
      clearInterval(interval);
    };
  }, [user, logout]);

  return <AuthContext.Provider value={{ user, login, verify, logout, loading, fetchAdmins }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
