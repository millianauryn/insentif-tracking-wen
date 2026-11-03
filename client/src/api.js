export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error?.message || 'Request failed')
    error.code = body.error?.code || 'REQUEST_FAILED'
    error.status = response.status
    throw error
  }
  return body
}

export function login(username, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function devLogin(name) {
  return apiRequest(`/api/auth/dev-login?user=${encodeURIComponent(name)}`, { method: 'POST' })
}

export function logout() {
  return apiRequest('/api/auth/logout', { method: 'POST' })
}

export function currentUser() {
  return apiRequest('/api/auth/me')
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

export function getDocument(id) {
  return apiRequest(`/api/documents/${id}`)
}

export function listDocuments() {
  return apiRequest('/api/documents')
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