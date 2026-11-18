import { describe, expect, it } from 'vitest'
import { canManageAdmin } from './access'

describe('admin UI access policy', () => {
  it('allows only Super Admin to manage users and criteria', () => {
    expect(canManageAdmin({ role: 'superadmin' })).toBe(true)
    expect(canManageAdmin({ role: 'officer' })).toBe(false)
    expect(canManageAdmin({ role: 'observer' })).toBe(false)
  })
})
