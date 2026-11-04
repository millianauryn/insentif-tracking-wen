import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { queryClient } from '../lib/queryClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // TIDAK ada data user di localStorage/browser storage —
  // satu-satunya sumber = backend via cookie httpOnly (/auth/me).
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    // Sesi BARU → buang SEMUA cache query. Respons server per-user
    // (list & stats officer ter-scope cabang) — tanpa ini, user berikut
    // di tab yang sama bisa melihat data user sebelumnya sampai staleTime.
    queryClient.clear();
    setUser(res.data.user);
    return res.data.user;
  }

  async function devLogin(name) {
    const res = await api.post(`/auth/dev-login?user=${name}`);
    queryClient.clear();
    setUser(res.data.user);
    return res.data.user;
  }

  function logout() {
    api.post('/auth/logout').catch(() => {});
    queryClient.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, devLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);