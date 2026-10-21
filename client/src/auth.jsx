import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, ApiError } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('expensetrack_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [sessionNotice, setSessionNotice] = useState('');

  const acceptSession = useCallback(({ token: nextToken, user: nextUser }) => {
    sessionStorage.setItem('expensetrack_token', nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setSessionNotice('');
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('expensetrack_token');
    setToken(null);
    setUser(null);
    setSessionNotice('');
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      logout();
      setSessionNotice('Your session expired. Sign in again to continue.');
    }
    window.addEventListener('expensetrack:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('expensetrack:unauthorized', handleUnauthorized);
  }, [logout]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    authApi.me(token)
      .then(result => { if (active) setUser(result.user); })
      .catch(error => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          logout();
          setSessionNotice('Your session expired. Sign in again to continue.');
        } else {
          setUser(null);
          setSessionNotice(error.message || 'Could not restore your session. Check the connection and sign in again.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, logout]);

  const value = useMemo(() => ({ token, user, loading, sessionNotice, acceptSession, logout }), [token, user, loading, sessionNotice, acceptSession, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
