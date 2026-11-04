import { describe, expect, it, vi } from 'vitest'
import { apiRequest, devLogin } from './api'

describe('apiRequest', () => {
  it('sends credentials for cookie sessions and returns JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 1 } }), { status: 200 }),
    ))

    await expect(apiRequest('/api/auth/me')).resolves.toEqual({ user: { id: 1 } })
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      credentials: 'include',
    }))
  })

  it('throws structured API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } }), { status: 401 }),
    ))

    await expect(apiRequest('/api/auth/login')).rejects.toMatchObject({
      code: 'AUTH_INVALID',
      message: 'Invalid credentials',
      status: 401,
    })
  })
})

describe('devLogin', () => {
  it('posts to the dev endpoint with the name in the query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 1, username: 'super', role: 'superadmin' } }), { status: 200 }),
    ))

    await expect(devLogin('super')).resolves.toEqual({ user: { id: 1, username: 'super', role: 'superadmin' } })
    expect(fetch).toHaveBeenCalledWith('/api/auth/dev-login?user=super', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
  })
})