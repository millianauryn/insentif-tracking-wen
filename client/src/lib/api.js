// Session: cookie httpOnly dikirim otomatis oleh browser — tidak ada token di localStorage.
// BASE_URL = base Vite ('/' lokal, '/app/...' di belakang nginx prefix)
// Fetch bawaan (tanpa axios) — format error disamakan: err.response/err.message.
const BASE = `${import.meta.env.BASE_URL}api`;
const LOGIN_PATH = `${import.meta.env.BASE_URL}login`.replace(/\/+$/, '');

function readCookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

async function request(method, url, { params, data, timeout = 20000 } = {}) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const headers = { 'Content-Type': 'application/json' };
  if (!['get', 'head', 'options'].includes(method.toLowerCase())) {
    const csrf = readCookie('pbg_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${BASE}${url}${qs}`, {
      method,
      headers,
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    const networkErr = new Error(err.name === 'AbortError' ? 'Timeout' : err.message);
    networkErr.code = 'NETWORK_ERROR';
    throw networkErr;
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(body?.error?.message || body?.message || `Request failed (${res.status})`);
    err.response = { status: res.status, data: body || {} };
    if (res.status === 401 && !window.location.pathname.startsWith(LOGIN_PATH)) {
      window.location.href = `${import.meta.env.BASE_URL}login`;
    }
    throw err;
  }
  return { data: body, status: res.status };
}

export const api = {
  get: (url, opts) => request('get', url, opts),
  post: (url, data) => request('post', url, { data }),
  patch: (url, data) => request('patch', url, { data }),
  delete: (url) => request('delete', url),
};

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
