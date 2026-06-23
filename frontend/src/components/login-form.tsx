'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { SpaInfo } from '@/lib/types'

export function LoginForm({ onLogin }: { onLogin: (spa: SpaInfo) => void }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 4) {
      toast.error('PIN phải từ 4-6 số')
      return
    }
    setLoading(true)
    try {
      const data = await api.post('/api/auth/login', { pin })
      if (data.token) {
        localStorage.setItem('spa_token', data.token)
      }
      const meData = await api.get('/api/auth/me')
      onLogin(meData.spa)
      toast.success(`Đăng nhập thành công! Chào mừng ${meData.spa.name}`)
    } catch (err: unknown) {
      localStorage.removeItem('spa_token')
      toast.error(err instanceof Error ? err.message : 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Ghost Worker</h1>
          <p className="text-muted-foreground mt-1">Dashboard quản lý Spa</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Mã PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Nhập PIN 4-6 số"
              className="w-full h-14 px-4 text-center text-2xl tracking-[0.5em] rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
          <p className="text-xs text-center text-muted-foreground">PIN mặc định: 1234</p>
        </form>
      </div>
    </div>
  )
}
