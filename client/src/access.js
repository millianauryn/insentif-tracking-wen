export function canManageAdmin(user) {
  return user?.role === 'superadmin'
}

export function canFinalizeDocument(user, status) {
  return status === 'Draft' && ['superadmin', 'officer'].includes(user?.role)
}
