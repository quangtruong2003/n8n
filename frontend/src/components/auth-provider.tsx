'use client'

import { createContext, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { AuthUser, TenantInfo } from '@/lib/types'

interface AuthState {
  user: AuthUser | null
  tenant: TenantInfo | null
  spa: { id: string; name: string; phone: string | null; openTime: string | null; closeTime: string | null; botActive: boolean; config: null; branches: any[] } | null
  spaId: string
  permissions: string[]
  updateSpa: (tenant: any) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me')
      if (res.success && res.data) {
        setUser(res.data.user)
        setTenant(res.data.tenant)
        setPermissions(res.data.permissions || [])
      } else {
        router.replace('/login')
      }
    } catch {
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem('session_token')
    if (!token) {
      router.replace('/login')
      return
    }
    fetchMe()
  }, [router, fetchMe])

  const updateSpa = useCallback((newTenant: TenantInfo) => {
    setTenant(newTenant)
  }, [])

  // Backward compatibility with legacy components expecting AuthContext.spa / spaId
  const spaCompat = tenant ? {
    id: tenant.id,
    name: tenant.name,
    phone: tenant.phone || null,
    openTime: tenant.open_time || null,
    closeTime: tenant.close_time || null,
    botActive: true,
    config: null,
    branches: [] // Will fetch branches individually on views
  } : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return null

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        spa: spaCompat,
        spaId: tenant?.id || '',
        permissions,
        updateSpa
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
