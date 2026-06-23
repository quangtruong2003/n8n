'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import type { SpaInfo } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('spa_token')
    if (token) {
      router.replace('/dashboard')
    }
  }, [router])

  const handleLogin = (_spa: SpaInfo) => {
    router.push('/dashboard')
  }

  return <LoginForm onLogin={handleLogin} />
}
