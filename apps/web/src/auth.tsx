import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type AuthUser } from './api';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  organizationId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setOrganizationId: (id: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'smartjob_token';
const ORG_KEY = 'smartjob_org';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizationId, setOrgId] = useState<string | null>(() =>
    localStorage.getItem(ORG_KEY),
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<AuthUser>('/auth/me', { token });
      setUser(me);
      if (
        !organizationId ||
        (!me.organizations.some((o) => o.id === organizationId) &&
          me.globalRole !== 'SUPER_ADMIN')
      ) {
        const first = me.organizations[0]?.id || null;
        setOrgId(first);
        if (first) localStorage.setItem(ORG_KEY, first);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      { method: 'POST', body: { email, password } },
    );
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    const first = res.user.organizations[0]?.id || null;
    setOrgId(first);
    if (first) localStorage.setItem(ORG_KEY, first);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_KEY);
    setToken(null);
    setUser(null);
    setOrgId(null);
  };

  const setOrganizationId = (id: string) => {
    if(id!==organizationId&&!window.dispatchEvent(new Event('smartjob-before-org-change',{cancelable:true})))return;
    setOrgId(id);
    localStorage.setItem(ORG_KEY, id);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      organizationId,
      loading,
      login,
      logout,
      setOrganizationId,
      refresh,
    }),
    [token, user, organizationId, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
