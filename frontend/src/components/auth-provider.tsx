'use client'

import { createContext, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { SpaInfo } from '@/lib/types'

interface AuthState {
  spa: SpaInfo
  spaId: string
  updateSpa: (spa: SpaInfo) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [spa, setSpa] = useState<SpaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('spa_token')
    if (!token) {
      router.replace('/login')
      return
    }
    api.get('/api/auth/me')
      .then((data) => {
        if (data.spa) {
          setSpa(data.spa)
        } else {
          router.replace('/login')
        }
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const updateSpa = useCallback((newSpa: SpaInfo) => {
    setSpa(newSpa)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!spa) return null

  return (
    <AuthContext.Provider value={{ spa, spaId: spa.id, updateSpa }}>
      {children}
    </AuthContext.Provider>
  )
}
