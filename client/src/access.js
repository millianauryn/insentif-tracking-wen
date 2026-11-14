export function canManageAdmin(user) {
  return user?.role === 'superadmin'
}

export function canFinalizeDocument(user, status) {
  return status === 'Draft' && ['superadmin', 'observer'].includes(user?.role)
}
