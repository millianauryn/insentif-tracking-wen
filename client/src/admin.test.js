import { describe, expect, it } from 'vitest'
import { canManageAdmin, canFinalizeDocument } from './access'

describe('admin UI access policy', () => {
  it('allows only Super Admin to manage users and criteria', () => {
    expect(canManageAdmin({ role: 'superadmin' })).toBe(true)
    expect(canManageAdmin({ role: 'officer' })).toBe(false)
    expect(canManageAdmin({ role: 'observer' })).toBe(false)
  })

  it('allows Officer and Super Admin to finalize Draft documents', () => {
    expect(canFinalizeDocument({ role: 'superadmin' }, 'Draft')).toBe(true)
    expect(canFinalizeDocument({ role: 'officer' }, 'Draft')).toBe(true)
    expect(canFinalizeDocument({ role: 'observer' }, 'Draft')).toBe(false)
    expect(canFinalizeDocument({ role: 'officer' }, 'Final')).toBe(false)
  })
})
