export function canManageAdmin(user) {
  return user?.role === 'superadmin'
}

