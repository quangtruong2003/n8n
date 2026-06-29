'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Vui lòng nhập tài khoản và mật khẩu')
      return
    }
    setLoading(true)
    try {
      const data = await api.post('/api/auth/login', {
        username: username.trim(),
        password: password.trim()
      })
      if (data.token) {
        localStorage.setItem('session_token', data.token)
      }
      onLogin()
      toast.success('Đăng nhập thành công!')
    } catch (err: unknown) {
      localStorage.removeItem('session_token')
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
          <p className="text-muted-foreground mt-1">Quản lý doanh nghiệp</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tài khoản</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tài khoản"
              className="w-full h-12 px-4 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full h-12 px-4 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Admin: admin/admin · Owner: owner_demo/password
          </p>
        </form>
      </div>
    </div>
  )
}
