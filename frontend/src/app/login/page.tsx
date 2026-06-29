'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('session_token')
    if (token) {
      router.replace('/dashboard')
    }
  }, [router])

  const handleLogin = () => {
    router.push('/dashboard')
  }

  return <LoginForm onLogin={handleLogin} />
}
