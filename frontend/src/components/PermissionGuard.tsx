'use client'

import React, { useContext } from 'react'
import { AuthContext } from './auth-provider'

export function PermissionGuard({
  children,
  fallback = null,
  resource,
  action
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  resource: string
  action: 'view' | 'create' | 'edit' | 'delete'
}) {
  const auth = useContext(AuthContext)
  if (!auth?.user) return <>{fallback}</>
  const { user, permissions } = auth

  // Super Admins and Owners bypass all role checks
  if (user.role === 'super_admin' || user.role === 'owner') {
    return <>{children}</>
  }

  const required = `${resource}:${action}`
  if (permissions.includes(required)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
