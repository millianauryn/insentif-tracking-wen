// Satu-satunya lapisan HTTP klien: CSRF double-submit, timeout 20dtk, redirect 401, format error seragam.
// apiRequest dipakai endpoint (path diawali '/api'), `api` dipakai AuthContext (path relatif: '/auth/me').
// Keduanya lewat buildUrl sehingga aturan BASE_URL cuma satu tempat.
const BASE = `${import.meta.env.BASE_URL}api`;
const LOGIN_PATH = `${import.meta.env.BASE_URL}login`.replace(/\/+$/, '');

function buildUrl(path) {
  const rel = path.startsWith('/api') ? path.slice(4) : path;
  return `${BASE}${rel}`;
}

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

async function raw(method, path, { params, data, timeout = 20000 } = {}) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const headers = new Headers();
  if (data !== undefined) headers.set('Content-Type', 'application/json');
  if (!['get', 'head', 'options'].includes(String(method).toLowerCase())) {
    const csrf = readCookie('pbg_csrf');
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${buildUrl(path)}${qs}`, {
      method,
      headers,
      credentials: 'include',
      body: data === undefined ? undefined : (typeof data === 'string' ? data : JSON.stringify(data)),
      signal: ctrl.signal,
    });
  } catch (err) {
    const error = new Error(err.name === 'AbortError' ? 'Timeout' : err.message);
    error.code = 'NETWORK_ERROR';
    throw error;
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const error = new Error(body?.error?.message || 'Request failed');
    error.code = body?.error?.code || 'REQUEST_FAILED';
    error.status = res.status;
    error.response = { status: res.status, data: body || {} };
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith(LOGIN_PATH)) {
      window.location.href = LOGIN_PATH;
    }
    throw error;
  }
  return body;
}

// Dipakai AuthContext: api.post('/auth/login', {...}) -> BASE + path.
export const api = {
  get: (path, opts) => raw('get', path, opts),
  post: (path, data) => raw('post', path, { data }),
};

export async function apiRequest(path, options = {}) {
  const { params, body, ...rest } = options;
  const method = rest.method || 'GET';
  return raw(method, path, { params, data: body, ...rest });
}

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

export function devLogin(name) {
  return apiRequest(`/api/auth/dev-login?user=${encodeURIComponent(name)}`, { method: 'POST' })
}

export function createDocument(input) {
  return apiRequest('/api/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateDocument(id, input) {
  return apiRequest(`/api/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function finalizeDocument(id) {
  return apiRequest(`/api/documents/${id}/finalize`, { method: 'POST' })
}

export function deleteDocument(id) {
  return apiRequest(`/api/documents/${id}`, { method: 'DELETE' })
}

export function getDocument(id) {
  return apiRequest(`/api/documents/${id}`)
}

// Default batas 500: daftar tumbuh per bulan, muat 500 teratas cukup untuk bertahun-tahun kantor.
export function listDocuments(params = { limit: 500 }) {
  return apiRequest('/api/documents', { params })
}

export function listDocumentFormats() {
  return apiRequest('/api/document-formats')
}

export function listUsers() {
  return apiRequest('/api/users')
}

export function listHierarchy() {
  return apiRequest('/api/users/hierarchy')
}

export function createUser(input) {
  return apiRequest('/api/users', { method: 'POST', body: JSON.stringify(input) })
}

export function updateUser(id, input) {
  return apiRequest(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteUser(id) {
  return apiRequest(`/api/users/${id}`, { method: 'DELETE' })
}

export function listPositions() {
  return apiRequest('/api/positions')
}

export function createPosition(input) {
  return apiRequest('/api/positions', { method: 'POST', body: JSON.stringify(input) })
}

export function updatePosition(id, input) {
  return apiRequest(`/api/positions/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deletePosition(id) {
  return apiRequest(`/api/positions/${id}`, { method: 'DELETE' })
}

export function listCriteria() {
  return apiRequest('/api/criteria-definitions')
}

export function updateCriteria(id, input) {
  return apiRequest(`/api/criteria-definitions/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function listMasterData() {
  return apiRequest('/api/master-data')
}

export function createDivision(input) {
  return apiRequest('/api/master-data/divisions', { method: 'POST', body: JSON.stringify(input) })
}

export function updateDivision(id, input) {
  return apiRequest(`/api/master-data/divisions/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteDivision(id) {
  return apiRequest(`/api/master-data/divisions/${id}`, { method: 'DELETE' })
}

export function createPrincipal(input) {
  return apiRequest('/api/master-data/principals', { method: 'POST', body: JSON.stringify(input) })
}

export function updatePrincipal(id, input) {
  return apiRequest(`/api/master-data/principals/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deletePrincipal(id) {
  return apiRequest(`/api/master-data/principals/${id}`, { method: 'DELETE' })
}

export function createBrand(input) {
  return apiRequest('/api/master-data/brands', { method: 'POST', body: JSON.stringify(input) })
}

export function updateBrand(id, input) {
  return apiRequest(`/api/master-data/brands/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteBrand(id) {
  return apiRequest(`/api/master-data/brands/${id}`, { method: 'DELETE' })
}

export function createRegion(input) {
  return apiRequest('/api/master-data/regions', { method: 'POST', body: JSON.stringify(input) })
}

export function updateRegion(id, input) {
  return apiRequest(`/api/master-data/regions/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteRegion(id) {
  return apiRequest(`/api/master-data/regions/${id}`, { method: 'DELETE' })
}

export function createBranch(input) {
  return apiRequest('/api/master-data/branches', { method: 'POST', body: JSON.stringify(input) })
}

export function updateBranch(id, input) {
  return apiRequest(`/api/master-data/branches/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteBranch(id) {
  return apiRequest(`/api/master-data/branches/${id}`, { method: 'DELETE' })
}