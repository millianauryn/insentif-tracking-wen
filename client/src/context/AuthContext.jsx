import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // TIDAK ada data user di localStorage/browser storage —
  // satu-satunya sumber = backend via cookie httpOnly (/auth/me).
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    setUser(res.user);
    return res.user;
  }

  async function devLogin(name) {
    const res = await api.post(`/auth/dev-login?user=${name}`);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // abaikan: state tetap dibersihkan
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, devLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
