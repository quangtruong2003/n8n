'use client'

import { useContext } from 'react'
import { AuthContext } from '@/components/auth-provider'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
