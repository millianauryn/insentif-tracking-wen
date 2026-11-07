import axios from 'axios';

// Session: cookie httpOnly dikirim otomatis oleh browser — tidak ada token di localStorage.
// BASE_URL = base Vite ('/' lokal, '/app/...' di belakang nginx prefix)
// 20s timeout: koneksi lemot → error cepat & jelas (toast) alih-alih hang tanpa batas
const api = axios.create({
  baseURL: `${import.meta.env.BASE_URL}api`,
  withCredentials: true,
  timeout: 20000,
});

function readCookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

// CSRF double-submit: semua request non-GET wajib bawa X-CSRF-Token = cookie pbg_csrf
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = readCookie('pbg_csrf');
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

// Halaman login dalam base — '/login' lokal, '/app/.../login' di balik nginx.
const LOGIN_PATH = `${import.meta.env.BASE_URL}login`.replace(/\/+$/, '');

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // sesi kedaluwarsa/invalid → kembali ke login (state di-reset via /auth/me)
      if (!window.location.pathname.startsWith(LOGIN_PATH)) {
        window.location.href = `${import.meta.env.BASE_URL}login`;
      }
    }
    return Promise.reject(err);
  }
);

export function errMsg(error) {
  if (!error?.response) {
    return 'Tidak dapat terhubung ke server. Pastikan API berjalan di port 3002.';
  }
  if (error.response.status === 429) {
    return 'Terlalu banyak percobaan masuk, coba lagi 15 menit lagi.';
  }
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Terjadi kesalahan.'
  );
}

export default api;