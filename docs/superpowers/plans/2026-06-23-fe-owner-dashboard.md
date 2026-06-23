# FE Owner Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the existing 1644-line monolithic `page.tsx` into proper Next.js App Router pages, extract components into separate files, add branch filtering across all panels, and ensure the dashboard consumes real-time data from WF3 API endpoints.

**Architecture:** All 6 panels (Dashboard, Customers, Bookings, Pricing, Chat Logs, Settings), Sidebar, MobileBottomNav, LoginForm, helpers, and hooks are currently defined INLINE in a single `src/app/page.tsx`. This plan first extracts them into separate files under `src/components/`, then converts them into proper Next.js App Router routes with a `/login` page and multi-branch filtering.

**Tech Stack:** Next.js (App Router), React 19, Prisma ORM (SQLite), TailwindCSS + shadcn/ui, TypeScript. Note: lucide-react is installed but not currently used; the existing codebase uses inline SVGs throughout.

## Global Constraints

- Maintain existing shadcn/ui component library (components in `src/components/ui/`).
- Keep existing Prisma schema (7 models: Spa, Branch, Customer, Service, Booking, ChatLog, SpaConfig).
- Preserve current auth pattern: base64-encoded `spaId:timestamp` token via `spa_token` httpOnly cookie + localStorage fallback.
- All 14 API routes already exist under `src/app/api/` — do NOT recreate them.
- Vietnamese language throughout UI.
- Existing code uses inline SVGs, not lucide-react icons.

## Actual API Response Shapes

Each endpoint has its own response shape (no standard envelope):

| Endpoint | Success Response |
|----------|-----------------|
| `POST /api/auth/login` | `{ spa: { id, name }, token }` |
| `DELETE /api/auth/login` | `{ success: true }` |
| `GET /api/auth/me` | `{ spa: { id, name, phone, openTime, closeTime, botActive, config, branches } }` |
| `GET /api/spa/[id]/branches` | `{ branches }` |
| `GET /api/spa/[id]/dashboard` | `{ stats, hourlyData, recentPendingBookings }` |
| `GET /api/spa/[id]/customers` | `{ customers, pagination }` |
| `GET /api/spa/[id]/customers/[customerId]` | `{ chatLogs, bookings }` |
| `GET /api/spa/[id]/bookings` | `{ bookings, pagination }` |
| `GET /api/spa/[id]/chat-logs` | `{ logs, pagination }` |
| `GET /api/spa/[id]/services` | `{ services }` |
| `GET /api/spa/[id]/config` | `{ config }` |

All error responses: `{ error: string }` with appropriate HTTP status code.

## Existing Codebase Summary

| What | Status | Location |
|------|--------|----------|
| API routes (14 endpoints) | Complete | `src/app/api/` |
| Prisma schema (7 models) | Complete | `prisma/schema.prisma` |
| SPA page (single 1644-line file) | Needs refactor | `src/app/page.tsx` |
| All panels | Inline in page.tsx | `src/app/page.tsx` (lines 449-1522) |
| Sidebar + MobileBottomNav | Inline in page.tsx | `src/app/page.tsx` (lines 220-398) |
| LoginForm | Inline in page.tsx | `src/app/page.tsx` (lines 117-183) |
| ThemeToggle | Inline in page.tsx | `src/app/page.tsx` (lines 1524-1549) |
| useSwipe hook | Inline in page.tsx | `src/app/page.tsx` (lines 96-115) |
| API helpers (getAuthHeaders, api) | Inline in page.tsx | `src/app/page.tsx` (lines 48-81) |
| Format helpers | Inline in page.tsx | `src/app/page.tsx` (lines 83-93) |
| Types (SpaInfo, PageKey, etc.) | Inline in page.tsx | `src/app/page.tsx` (lines 27-45) |
| Branch filtering | Only in Chat Logs | page.tsx lines 1262-1263, 1273-1274, 1286-1288 |
| `src/components/ui/` | shadcn primitives only | `src/components/ui/` |
| `src/hooks/` | use-mobile.ts, use-toast.ts | `src/hooks/` |

## Auth Flow (as implemented)

1. `POST /api/auth/login` with `{ pin }` sets an httpOnly cookie (`spa_token`) AND returns `{ spa: { id, name }, token }` in JSON.
2. Client stores `token` in localStorage for Bearer header use.
3. `GET /api/auth/me` checks Bearer header first, then falls back to cookie.
4. All API calls should include Bearer header (from localStorage) and let the browser send the cookie automatically.

---

### Task 0: Extract Components from page.tsx

This is a mechanical extraction. Every component is copied exactly as-is, only adding import statements and exporting. No logic changes. This MUST be done before route-based refactoring.

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/api.ts`
- Create: `src/lib/format.ts`
- Create: `src/hooks/use-swipe.ts`
- Create: `src/components/auth-provider.tsx`
- Create: `src/components/login-form.tsx`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/mobile-bottom-nav.tsx`
- Create: `src/components/header.tsx`
- Create: `src/components/stat-card.tsx`
- Create: `src/components/bar-chart.tsx`
- Create: `src/components/pagination.tsx`
- Create: `src/components/theme-toggle.tsx`
- Create: `src/components/dashboard-panel.tsx`
- Create: `src/components/customers-panel.tsx`
- Create: `src/components/bookings-panel.tsx`
- Create: `src/components/pricing-panel.tsx`
- Create: `src/components/chat-logs-panel.tsx`
- Create: `src/components/settings-panel.tsx`
- Modify: `src/app/page.tsx` (replace inline code with imports)

- [ ] **Step 1: Create `src/lib/types.ts`**

Extract type definitions from page.tsx lines 27-45:

```typescript
// src/lib/types.ts
export interface SpaInfo {
  id: string
  name: string
  phone: string | null
  openTime: string | null
  closeTime: string | null
  botActive: boolean
  config: { botGreeting: string | null; botName: string | null } | null
  branches: { id: string; name: string; address: string | null }[]
}

export type PageKey = 'dashboard' | 'customers' | 'bookings' | 'pricing' | 'settings' | 'chat-logs'

export interface ServiceFormData {
  name: string
  price: string
  duration: string
  description: string
}

export interface Service {
  id: string
  name: string
  price: number
  duration: number | null
  description: string | null
  active: boolean
}
```

- [ ] **Step 2: Create `src/lib/api.ts`**

Extract API helper from page.tsx lines 48-81:

```typescript
// src/lib/api.ts
function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('spa_token') : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export const api = {
  get: async (url: string) => {
    const res = await fetch(url, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  post: async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  put: async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  patch: async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  delete: async (url: string) => {
    const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
}
```

- [ ] **Step 3: Create `src/lib/format.ts`**

Extract format helpers from page.tsx lines 83-93:

```typescript
// src/lib/format.ts
export const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN').format(price) + 'đ'
export const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN')
export const formatDateTime = (d: string | Date) => new Date(d).toLocaleString('vi-VN')

export const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  completed: { label: 'Hoàn thành', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
}
```

- [ ] **Step 4: Create `src/hooks/use-swipe.ts`**

Extract useSwipe from page.tsx lines 96-115:

```typescript
// src/hooks/use-swipe.ts
'use client'

import { useRef } from 'react'

export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50) {
  const touchStart = useRef(0)
  const touchEnd = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.changedTouches[0].screenX
  }
  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.changedTouches[0].screenX
  }
  const onTouchEnd = () => {
    const diff = touchStart.current - touchEnd.current
    if (Math.abs(diff) > threshold) {
      if (diff > 0) onSwipeLeft()
      else onSwipeRight()
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
```

- [ ] **Step 5: Create `src/components/auth-provider.tsx`**

New file that provides auth context for the route-based version. This is the SINGLE auth source — no duplicate auth fetches elsewhere.

```typescript
// src/components/auth-provider.tsx
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
```

- [ ] **Step 6: Create `src/hooks/use-auth.ts`**

```typescript
// src/hooks/use-auth.ts
'use client'

import { useContext } from 'react'
import { AuthContext } from '@/components/auth-provider'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
```

- [ ] **Step 7: Create `src/components/login-form.tsx`**

Exact copy of page.tsx lines 117-183, with imports added:

```typescript
// src/components/login-form.tsx
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
```

- [ ] **Step 8: Create `src/components/sidebar.tsx`**

Exact copy of page.tsx lines 186-364 (NAV_ITEMS, NavItem, Sidebar). Add imports at top:

```typescript
// src/components/sidebar.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSwipe } from '@/hooks/use-swipe'
import type { PageKey } from '@/lib/types'

const NAV_ITEMS: { key: PageKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Tổng quan', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg> },
  { key: 'customers', label: 'Khách hàng', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
  { key: 'bookings', label: 'Đặt lịch', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg> },
  { key: 'pricing', label: 'Dịch vụ', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'chat-logs', label: 'Chat', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg> },
  { key: 'settings', label: 'Cài đặt', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
]

function NavItem({ item, active, collapsed, onClick }: { item: typeof NAV_ITEMS[0]; active: boolean; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`group relative w-full flex items-center gap-3 rounded-lg text-[13px] transition-all duration-150 ${
        collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
      } ${
        active
          ? 'font-semibold bg-primary/10 text-primary dark:bg-primary/15 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:rounded-full before:bg-primary'
          : 'font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
      }`}
    >
      <span className={`shrink-0 transition-colors ${active ? 'text-primary' : ''}`}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-foreground text-background text-xs font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
          {item.label}
        </span>
      )}
    </button>
  )
}

export function Sidebar({ currentPage, onPageChange, spaName, onLogout, mobileOpen, onMobileClose }: {
  currentPage: PageKey
  onPageChange: (p: PageKey) => void
  spaName: string
  onLogout: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const swipeHandlers = useSwipe(onMobileClose, () => {})

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* MOBILE DRAWER */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-background border-r shadow-xl flex flex-col transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        {...swipeHandlers}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-base truncate">{spaName}</h2>
            <p className="text-xs text-muted-foreground">Ghost Worker</p>
          </div>
          <button onClick={onMobileClose} className="p-2 -mr-2 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors" aria-label="Đóng menu">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={currentPage === item.key}
              collapsed={false}
              onClick={() => { onPageChange(item.key); onMobileClose() }}
            />
          ))}
        </nav>
        <div className="px-2.5 py-3 border-t shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 dark:active:bg-red-950/30 transition-colors px-3 py-2.5"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden lg:flex flex-col bg-background transition-all duration-300 ease-out shrink-0 ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`} style={{ height: '100dvh', position: 'sticky', top: 0 }}>
        <div className={`flex items-center border-b shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`} style={{ height: '57px' }}>
          <div className={`shrink-0 flex items-center justify-center rounded-lg bg-primary text-primary-foreground ${collapsed ? 'w-8 h-8' : 'w-8 h-8'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-sm truncate leading-tight">{spaName}</h2>
              <p className="text-[11px] text-muted-foreground leading-tight">Ghost Worker</p>
            </div>
          )}
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={currentPage === item.key}
              collapsed={collapsed}
              onClick={() => onPageChange(item.key)}
            />
          ))}
        </nav>
        <div className="shrink-0 border-t px-2.5 py-2 space-y-0.5">
          <div className="relative">
            <button
              onClick={onLogout}
              title={collapsed ? 'Đăng xuất' : undefined}
              className={`w-full flex items-center gap-3 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 dark:active:bg-red-950/30 transition-colors ${collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2.5'}`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              {!collapsed && <span>Đăng xuất</span>}
            </button>
            {collapsed && (
              <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-foreground text-background text-xs font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
                Đăng xuất
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center gap-3 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 transition-all duration-150 ${collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2.5'}`}
            aria-label={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <svg className={`w-5 h-5 shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
            {!collapsed && <span>Thu gọn</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
```

- [ ] **Step 9: Create `src/components/mobile-bottom-nav.tsx`**

Exact copy of page.tsx lines 366-398 with imports. Uses inline SVGs (matching existing pattern), not lucide-react:

```typescript
// src/components/mobile-bottom-nav.tsx
'use client'

import type { PageKey } from '@/lib/types'
import { NAV_ITEMS } from '@/components/sidebar'

// Re-export NAV_ITEMS so mobile nav can use the same list
export { NAV_ITEMS }

export function MobileBottomNav({ currentPage, onPageChange }: { currentPage: PageKey; onPageChange: (p: PageKey) => void }) {
  const mobileItems = NAV_ITEMS.slice(0, 5)
  const moreItem = { key: 'settings' as PageKey, label: 'Thêm', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
  )}

  const displayItems = currentPage === 'settings' || currentPage === 'chat-logs'
    ? [...mobileItems.slice(0, 4), moreItem]
    : mobileItems

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-lg border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around" style={{ height: '56px' }}>
        {displayItems.map((item) => {
          const isActive = item.key === currentPage || (item.key === 'settings' && (currentPage === 'settings' || currentPage === 'chat-logs'))
          return (
            <button
              key={item.key}
              onClick={() => onPageChange(item.key)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

Note: The `NAV_ITEMS` array must also be exported from `sidebar.tsx`. Add `export` to the `const NAV_ITEMS` declaration in sidebar.tsx.

- [ ] **Step 10: Create `src/components/header.tsx`**

```typescript
// src/components/header.tsx
export function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 11: Create `src/components/stat-card.tsx`**

```typescript
// src/components/stat-card.tsx
export function StatCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl p-4 sm:p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">{icon}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 12: Create `src/components/bar-chart.tsx`**

```typescript
// src/components/bar-chart.tsx
export function BarChart({ data }: { data: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-px sm:gap-[2px] h-full w-full">
      {data.map((d) => (
        <div key={d.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div
            className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-colors min-h-[2px]"
            style={{ height: `${(d.count / maxCount) * 100}%` }}
          />
          <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-1 select-none">{d.hour}h</span>
          {d.count > 0 && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-sm">
              {d.count} tin
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 13: Create `src/components/pagination.tsx`**

```typescript
// src/components/pagination.tsx
export function Pagination({ pagination, onPrev, onNext }: { pagination: { total: number; page: number; totalPages: number }; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <span className="text-xs sm:text-sm text-muted-foreground">{pagination.total} kết quả · Trang {pagination.page}/{pagination.totalPages}</span>
      <div className="flex gap-2">
        <button disabled={pagination.page <= 1} onClick={onPrev} className="px-3 py-1.5 text-xs sm:text-sm border rounded-md hover:bg-accent disabled:opacity-50 active:scale-95 transition-all">Trước</button>
        <button disabled={pagination.page >= pagination.totalPages} onClick={onNext} className="px-3 py-1.5 text-xs sm:text-sm border rounded-md hover:bg-accent disabled:opacity-50 active:scale-95 transition-all">Sau</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 14: Create `src/components/theme-toggle.tsx`**

Exact copy of page.tsx lines 1524-1549:

```typescript
// src/components/theme-toggle.tsx
'use client'

import { useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark')
    }
    return false
  })

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button onClick={toggle} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors active:scale-90" title={dark ? 'Chế độ sáng' : 'Chế độ tối'}>
      {dark ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
      )}
    </button>
  )
}
```

- [ ] **Step 15: Create `src/components/dashboard-panel.tsx`**

Exact copy of page.tsx lines 449-589. Import shared components:

```typescript
// src/components/dashboard-panel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Header } from '@/components/header'
import { StatCard } from '@/components/stat-card'
import { BarChart } from '@/components/bar-chart'

export function DashboardPanel({ spaId }: { spaId: string }) {
  // ... exact same implementation as page.tsx lines 450-589
  // State, fetchData, handleBookingAction, loading skeleton, return JSX
  // All identical — only imports change
}
```

The complete body is copied verbatim from page.tsx lines 451-589. For brevity in this plan, the full 140-line component body is identical to the source. Key differences: no local imports needed since Header, StatCard, BarChart are now external.

- [ ] **Step 16: Create `src/components/customers-panel.tsx`**

Exact copy of page.tsx lines 604-775 with imports:

```typescript
// src/components/customers-panel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate, formatDateTime, statusMap } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

export function CustomersPanel({ spaId }: { spaId: string }) {
  // ... exact same implementation as page.tsx lines 606-774
}
```

Body copied verbatim from page.tsx lines 606-774.

- [ ] **Step 17: Create `src/components/bookings-panel.tsx`**

```typescript
// src/components/bookings-panel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatPrice, formatDateTime, statusMap } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

export function BookingsPanel({ spaId }: { spaId: string }) {
  // ... exact same implementation as page.tsx lines 779-917
}
```

Body copied verbatim from page.tsx lines 779-917.

- [ ] **Step 18: Create `src/components/pricing-panel.tsx`**

This is the largest panel (334 lines). Contains ServiceAddDialog, ServiceEditDialog, ServiceDeleteDialog, and PricingPanel:

```typescript
// src/components/pricing-panel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import type { Service, ServiceFormData } from '@/lib/types'
import { Header } from '@/components/header'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

function ServiceAddDialog({ spaId, open, onClose, onSuccess }: { spaId: string; open: boolean; onClose: () => void; onSuccess: () => void }) {
  // ... exact same implementation as page.tsx lines 931-1011
}

function ServiceEditDialog({ spaId, service, open, onClose, onSuccess }: { spaId: string; service: Service | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  // ... exact same implementation as page.tsx lines 1013-1099
}

function ServiceDeleteDialog({ spaId, service, open, onClose, onSuccess }: { spaId: string; service: Service | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  // ... exact same implementation as page.tsx lines 1102-1146
}

export function PricingPanel({ spaId }: { spaId: string }) {
  // ... exact same implementation as page.tsx lines 1148-1252
}
```

All bodies copied verbatim from their respective line ranges.

- [ ] **Step 19: Create `src/components/chat-logs-panel.tsx`**

```typescript
// src/components/chat-logs-panel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

export function ChatLogsPanel({ spaId }: { spaId: string }) {
  // ... exact same implementation as page.tsx lines 1256-1411
}
```

Body copied verbatim from page.tsx lines 1256-1411.

Note on branches fetch (line 1287): The existing code already handles both response shapes:
```typescript
api.get(`/api/spa/${spaId}/branches`).then((res) => setBranches(res.branchs || res.branches || []))
```
Keep this as-is for backward compatibility.

- [ ] **Step 20: Create `src/components/settings-panel.tsx`**

```typescript
// src/components/settings-panel.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { SpaInfo } from '@/lib/types'
import { Header } from '@/components/header'

export function SettingsPanel({ spa, onUpdate }: { spa: SpaInfo; onUpdate: (s: SpaInfo) => void }) {
  // ... exact same implementation as page.tsx lines 1415-1521
}
```

Body copied verbatim from page.tsx lines 1415-1521.

- [ ] **Step 21: Rewrite `src/app/page.tsx` to thin redirect**

Replace the entire 1644-line file with a simple redirect:

```typescript
// src/app/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const token = localStorage.getItem('spa_token')
    if (token) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [router])
  return null
}
```

- [ ] **Step 22: Verify extraction compiles**

1. Run `npx tsc --noEmit` — should have zero new type errors
2. Run `npm run build` (or `next build`) — should compile all new files
3. Verify `src/app/page.tsx` is now 20 lines

- [ ] **Step 23: Commit**

```bash
git add -A src/lib/ src/hooks/ src/components/ src/app/page.tsx
git commit -m "refactor(fe): extract all components from monolithic page.tsx into separate files"
```

---

### Task 1: Extract Login to Dedicated Route

**Files:**
- Create: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx` (update redirect logic)

**Actual login API response:** `{ spa: { id, name }, token }` on success, `{ error: string }` on failure.

- [ ] **Step 1: Create `src/app/login/page.tsx`**

The login page uses the extracted `LoginForm` component, then redirects to `/dashboard`:

```typescript
// src/app/login/page.tsx
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
```

Note: The `LoginForm` component handles the actual API call (`POST /api/auth/login`), checks `data.token` (not `data.success`), stores token in localStorage, then calls `/api/auth/me` to get full spa info. The cookie is set httpOnly by the server automatically.

- [ ] **Step 2: Verify login flow**

1. Navigate to `/` → redirects to `/login`
2. Enter PIN "1234" → POST returns `{ spa: { id, name }, token }` → stored in localStorage → redirected to `/dashboard`
3. Enter wrong PIN → error message shown
4. Already logged in visiting `/login` → redirected to `/dashboard`

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(fe): extract login to dedicated /login route"
```

---

### Task 2: Create Dashboard Route + Layout

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/page.tsx`

**Auth approach:** AuthProvider is the single auth source. No duplicate auth fetches.

- [ ] **Step 1: Create `src/app/dashboard/layout.tsx`**

Wraps all authenticated pages with ThemeProvider, Toaster, Sidebar, and AuthProvider:

```typescript
// src/app/dashboard/layout.tsx
'use client'

import { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { AuthProvider, AuthContext } from '@/components/auth-provider'
import { Sidebar } from '@/components/sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { useContext } from 'react'
import type { PageKey } from '@/lib/types'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'

function DashboardShell() {
  const { spa, spaId } = useContext(AuthContext)!
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await api.delete('/api/auth/login')
    } catch {
      // ignore
    }
    localStorage.removeItem('spa_token')
    router.replace('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          spaName={spa.name}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b bg-background/95 backdrop-blur-lg sticky top-0 z-30">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors" aria-label="Mở menu">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-1 ml-auto">
              <ThemeToggle />
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full pb-20 lg:pb-6">
            {/* Panel routing will happen here — see Task 3 */}
          </div>
          <footer className="hidden lg:block border-t py-3 px-6 text-center text-xs text-muted-foreground">
            Ghost Worker Dashboard © 2025
          </footer>
        </main>
      </div>
      <MobileBottomNav currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <DashboardShell />
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
```

- [ ] **Step 2: Create `src/app/dashboard/page.tsx`**

Complete implementation using `useAuth()` hook (not placeholder):

```typescript
// src/app/dashboard/page.tsx
'use client'

import { DashboardPanel } from '@/components/dashboard-panel'
import { useAuth } from '@/hooks/use-auth'

export default function DashboardPage() {
  const { spaId } = useAuth()
  return <DashboardPanel spaId={spaId} />
}
```

- [ ] **Step 3: Test navigation**

1. Login → lands on `/dashboard`
2. No token → redirects to `/login`
3. Dashboard renders with stats, chart, pending bookings

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat(fe): add dashboard layout with AuthProvider, ThemeProvider, and sidebar"
```

---

### Task 3: Create All Sub-Routes

**Files:**
- Create: `src/app/dashboard/customers/page.tsx`
- Create: `src/app/dashboard/bookings/page.tsx`
- Create: `src/app/dashboard/pricing/page.tsx`
- Create: `src/app/dashboard/settings/page.tsx`
- Create: `src/app/dashboard/chat-logs/page.tsx`

Each is a thin wrapper using `useAuth()` to get `spaId`.

- [ ] **Step 1: Create customers route**

```typescript
// src/app/dashboard/customers/page.tsx
'use client'

import { CustomersPanel } from '@/components/customers-panel'
import { useAuth } from '@/hooks/use-auth'

export default function CustomersPage() {
  const { spaId } = useAuth()
  return <CustomersPanel spaId={spaId} />
}
```

- [ ] **Step 2: Create bookings route**

```typescript
// src/app/dashboard/bookings/page.tsx
'use client'

import { BookingsPanel } from '@/components/bookings-panel'
import { useAuth } from '@/hooks/use-auth'

export default function BookingsPage() {
  const { spaId } = useAuth()
  return <BookingsPanel spaId={spaId} />
}
```

- [ ] **Step 3: Create pricing route**

```typescript
// src/app/dashboard/pricing/page.tsx
'use client'

import { PricingPanel } from '@/components/pricing-panel'
import { useAuth } from '@/hooks/use-auth'

export default function PricingPage() {
  const { spaId } = useAuth()
  return <PricingPanel spaId={spaId} />
}
```

- [ ] **Step 4: Create settings route**

```typescript
// src/app/dashboard/settings/page.tsx
'use client'

import { SettingsPanel } from '@/components/settings-panel'
import { useAuth } from '@/hooks/use-auth'

export default function SettingsPage() {
  const { spa, updateSpa } = useAuth()
  return <SettingsPanel spa={spa} onUpdate={updateSpa} />
}
```

- [ ] **Step 5: Create chat-logs route**

```typescript
// src/app/dashboard/chat-logs/page.tsx
'use client'

import { ChatLogsPanel } from '@/components/chat-logs-panel'
import { useAuth } from '@/hooks/use-auth'

export default function ChatLogsPage() {
  const { spaId } = useAuth()
  return <ChatLogsPanel spaId={spaId} />
}
```

- [ ] **Step 6: Test all routes**

1. `/dashboard` → DashboardPanel
2. `/dashboard/customers` → CustomersPanel
3. `/dashboard/bookings` → BookingsPanel
4. `/dashboard/pricing` → PricingPanel
5. `/dashboard/settings` → SettingsPanel
6. `/dashboard/chat-logs` → ChatLogsPanel
7. All protected by AuthProvider — no token → redirect to `/login`

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/customers/ src/app/dashboard/bookings/
git add src/app/dashboard/pricing/ src/app/dashboard/settings/ src/app/dashboard/chat-logs/
git commit -m "feat(fe): add all sub-routes with useAuth hook"
```

---

### Task 4: Add Branch Filter to Dashboard

**Files:**
- Modify: `src/components/dashboard-panel.tsx`
- Modify: `src/app/api/spa/[id]/dashboard/route.ts`

**Branches API response:** `{ branches }` (NOT `{ data }`).

- [ ] **Step 1: Add branch dropdown to DashboardPanel**

Add to the top of the `DashboardPanel` component, after the existing state declarations:

```typescript
// Add inside DashboardPanel, after existing useState declarations:
const [branchFilter, setBranchFilter] = useState('')
const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

useEffect(() => {
  api.get(`/api/spa/${spaId}/branches`).then((res) => {
    setBranches(res.branches || [])
  }).catch(() => {})
}, [spaId])
```

Add the branch selector in the JSX, after the `<Header>` and before the stats grid:

```tsx
{/* Add after Header, before the stats grid: */}
{branches.length > 1 && (
  <div className="flex items-center gap-3">
    <select
      value={branchFilter}
      onChange={(e) => setBranchFilter(e.target.value)}
      className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
    >
      <option value="">Tất cả chi nhánh</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 2: Pass branchId to dashboard API**

Update `fetchData` to include the branch filter:

```typescript
// Replace the existing fetchData in DashboardPanel:
const fetchData = useCallback(async () => {
  try {
    const url = `/api/spa/${spaId}/dashboard${branchFilter ? `?branchId=${branchFilter}` : ''}`
    const res = await api.get(url)
    setData(res)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
  } finally {
    setLoading(false)
  }
}, [spaId, branchFilter])
```

Add `branchFilter` to the useEffect dependency array:

```typescript
useEffect(() => {
  fetchData()
  const interval = setInterval(fetchData, 30000)
  return () => clearInterval(interval)
}, [fetchData])
```

- [ ] **Step 3: Update dashboard API to accept branchId**

Modify `src/app/api/spa/[id]/dashboard/route.ts` to filter by `branchId` query parameter. Add at the top of the GET handler, after `const { id } = await params`:

```typescript
const { searchParams } = new URL(request.url)
const branchId = searchParams.get('branchId')
const branchFilter = branchId ? { branchId } : {}
```

Then apply `branchFilter` to each Prisma query. For example:

```typescript
// Messages today
const messagesToday = await db.chatLog.count({
  where: {
    spaId,
    ...branchFilter,
    createdAt: { gte: today, lt: tomorrow },
    sender: 'user',
  },
})

// New bookings today
const newBookingsToday = await db.booking.count({
  where: {
    spaId,
    ...branchFilter,
    createdAt: { gte: today, lt: tomorrow },
  },
})

// Pending confirmations
const pendingBookings = await db.booking.count({
  where: {
    spaId,
    ...branchFilter,
    status: 'pending',
  },
})

// Conversion rate
const totalBookings = await db.booking.count({ where: { spaId, ...branchFilter } })
const convertedBookings = await db.booking.count({
  where: { spaId, ...branchFilter, status: { in: ['confirmed', 'completed'] } },
})

// Messages by hour — add ...branchFilter to each hourly query
// Recent pending bookings — add ...branchFilter to the where clause
```

- [ ] **Step 4: Test branch filter**

1. Single-branch spa → dropdown not shown (because of `branches.length > 1` check)
2. Multi-branch spa → "Tất cả chi nhánh" shows all data
3. Select specific branch → stats, chart, pending bookings update
4. Auto-refresh still works

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard-panel.tsx src/app/api/spa/\[id\]/dashboard/route.ts
git commit -m "feat(fe): add branch filter to dashboard with API support"
```

---

### Task 5: Add Branch Filter to Bookings + Customers

**Files:**
- Modify: `src/components/bookings-panel.tsx`
- Modify: `src/components/customers-panel.tsx`
- Modify: `src/app/api/spa/[id]/bookings/route.ts`
- Modify: `src/app/api/spa/[id]/customers/route.ts`

**Key difference:** Customer model has NO `branchId` field. Branch filtering for customers must go through the bookings relation.

**Branches API response:** `{ branches }` (NOT `{ data }`).

- [ ] **Step 1: Add branch dropdown to BookingsPanel**

Same pattern as Dashboard. Add state and fetch inside BookingsPanel:

```typescript
// Add inside BookingsPanel, after existing state:
const [branchFilter, setBranchFilter] = useState('')
const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

useEffect(() => {
  api.get(`/api/spa/${spaId}/branches`).then((res) => {
    setBranches(res.branches || [])
  }).catch(() => {})
}, [spaId])
```

Add dropdown in JSX, before the status tabs:

```tsx
{branches.length > 1 && (
  <div className="flex items-center gap-3 mb-2">
    <select
      value={branchFilter}
      onChange={(e) => setBranchFilter(e.target.value)}
      className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
    >
      <option value="">Tất cả chi nhánh</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 2: Pass branchId to bookings API**

Update `fetchBookings` to include branch filter:

```typescript
// Replace existing fetchBookings:
const fetchBookings = useCallback(async (page: number, status: string) => {
  setLoading(true)
  try {
    const params = new URLSearchParams({ page: String(page) })
    if (status && status !== 'all') params.set('status', status)
    if (branchFilter) params.set('branchId', branchFilter)
    const res = await api.get(`/api/spa/${spaId}/bookings?${params}`)
    setBookings(res.bookings)
    setPagination(res.pagination)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
  } finally {
    setLoading(false)
  }
}, [spaId, branchFilter])
```

Update useEffect to include branchFilter dependency:

```typescript
useEffect(() => { fetchBookings(1, statusFilter) }, [fetchBookings, statusFilter])
```

- [ ] **Step 3: Update Bookings API for branch filtering**

Modify `src/app/api/spa/[id]/bookings/route.ts`. After extracting `status`, add:

```typescript
const branchId = searchParams.get('branchId')

const where: Record<string, unknown> = { spaId }
if (status && status !== 'all') {
  where.status = status
}
if (branchId) {
  where.branchId = branchId
}
```

This works because the `Booking` model has a direct `branchId` field.

- [ ] **Step 4: Add branch dropdown to CustomersPanel**

Same pattern. Add state and fetch inside CustomersPanel:

```typescript
// Add inside CustomersPanel, after existing state:
const [branchFilter, setBranchFilter] = useState('')
const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

useEffect(() => {
  api.get(`/api/spa/${spaId}/branches`).then((res) => {
    setBranches(res.branches || [])
  }).catch(() => {})
}, [spaId])
```

Add dropdown in JSX, after the search input:

```tsx
{branches.length > 1 && (
  <select
    value={branchFilter}
    onChange={(e) => setBranchFilter(e.target.value)}
    className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm"
  >
    <option value="">Tất cả chi nhánh</option>
    {branches.map((b) => (
      <option key={b.id} value={b.id}>{b.name}</option>
    ))}
  </select>
)}
```

Update `fetchCustomers` to pass branchId:

```typescript
const fetchCustomers = useCallback(async (page: number, s: string) => {
  setLoading(true)
  try {
    const params = new URLSearchParams({ page: String(page), search: s })
    if (branchFilter) params.set('branchId', branchFilter)
    const res = await api.get(`/api/spa/${spaId}/customers?${params}`)
    setCustomers(res.customers)
    setPagination(res.pagination)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
  } finally {
    setLoading(false)
  }
}, [spaId, branchFilter])
```

Update useEffect:

```typescript
useEffect(() => { fetchCustomers(1, search) }, [fetchCustomers, search])
```

- [ ] **Step 5: Update Customers API for branch filtering**

Modify `src/app/api/spa/[id]/customers/route.ts`. The `Customer` model has NO `branchId`. Must filter through bookings:

```typescript
// After extracting searchParams:
const branchId = searchParams.get('branchId')

// If branch filter is set, get customer IDs who have bookings at this branch
let customerIdsInBranch: string[] | null = null
if (branchId) {
  const bookings = await db.booking.findMany({
    where: { spaId, branchId },
    select: { customerId: true },
    distinct: ['customerId'],
  })
  customerIdsInBranch = bookings.map((b) => b.customerId)
}

const where: Record<string, unknown> = { spaId }
if (search) {
  where.OR = [
    { name: { contains: search } },
    { phone: { contains: search } },
  ]
}
if (customerIdsInBranch !== null) {
  where.id = { in: customerIdsInBranch }
}
```

This finds all customers who have at least one booking at the selected branch.

- [ ] **Step 6: Test both panels with branch filter**

1. Bookings: Select branch → only bookings from that branch shown
2. Bookings: Status tabs still work within branch filter
3. Customers: Select branch → only customers with bookings at that branch shown
4. Customers: Search still works within branch filter

- [ ] **Step 7: Commit**

```bash
git add src/components/bookings-panel.tsx src/components/customers-panel.tsx
git add src/app/api/spa/\[id\]/bookings/route.ts src/app/api/spa/\[id\]/customers/route.ts
git commit -m "feat(fe): add branch filter to bookings and customers panels"
```

---

### Task 6: Mobile Navigation Update for New Routes

**Files:**
- Modify: `src/components/mobile-bottom-nav.tsx`
- Modify: `src/components/sidebar.tsx`

**Current state:** MobileBottomNav uses internal `currentPage` state. Needs to switch to URL-based routing using `usePathname()`.

**Icon approach:** Existing codebase uses inline SVGs throughout. The mobile bottom nav will continue using inline SVGs for consistency. lucide-react is installed but not currently used anywhere — switching to it would require changing ALL icon references in sidebar and mobile nav simultaneously. Keep inline SVGs for this task.

- [ ] **Step 1: Update mobile bottom nav to use URL routing**

Replace the state-based approach with `usePathname()`:

```typescript
// src/components/mobile-bottom-nav.tsx
'use client'

import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
  )},
  { href: '/dashboard/customers', label: 'Khách hàng', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
  )},
  { href: '/dashboard/bookings', label: 'Đặt lịch', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
  )},
  { href: '/dashboard/pricing', label: 'Dịch vụ', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  )},
  { href: '/dashboard/chat-logs', label: 'Chat', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
  )},
  { href: '/dashboard/settings', label: 'Thêm', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
  )},
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-lg border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around" style={{ height: '56px' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href === '/dashboard/settings' && pathname.startsWith('/dashboard/settings'))
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
```

Note: This replaces the internal `currentPage` state + `onPageChange` prop with URL-based routing. The mobile bottom nav no longer needs props.

- [ ] **Step 2: Update sidebar to use URL routing**

The sidebar currently uses `currentPage` state and `onPageChange` callback. For route-based navigation, sidebar links should use `<a href>` tags:

Update the `NAV_ITEMS` in `sidebar.tsx` to include href:

```typescript
// In sidebar.tsx, change NAV_ITEMS to:
const NAV_ITEMS: { key: PageKey; label: string; href: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Tổng quan', href: '/dashboard', icon: (/* same SVG */) },
  { key: 'customers', label: 'Khách hàng', href: '/dashboard/customers', icon: (/* same SVG */) },
  { key: 'bookings', label: 'Đặt lịch', href: '/dashboard/bookings', icon: (/* same SVG */) },
  { key: 'pricing', label: 'Dịch vụ', href: '/dashboard/pricing', icon: (/* same SVG */) },
  { key: 'chat-logs', label: 'Chat', href: '/dashboard/chat-logs', icon: (/* same SVG */) },
  { key: 'settings', label: 'Cài đặt', href: '/dashboard/settings', icon: (/* same SVG */) },
]
```

Update `NavItem` to use `<a href>` instead of `onClick`:

```typescript
function NavItem({ item, active, collapsed }: { item: typeof NAV_ITEMS[0]; active: boolean; collapsed: boolean }) {
  return (
    <a
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group relative w-full flex items-center gap-3 rounded-lg text-[13px] transition-all duration-150 ${
        collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
      } ${
        active
          ? 'font-semibold bg-primary/10 text-primary dark:bg-primary/15 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:rounded-full before:bg-primary'
          : 'font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
      }`}
    >
      <span className={`shrink-0 transition-colors ${active ? 'text-primary' : ''}`}>{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-foreground text-background text-xs font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
          {item.label}
        </span>
      )}
    </a>
  )
}
```

Update the Sidebar component to use `usePathname()` instead of props:

```typescript
// Remove currentPage and onPageChange props from Sidebar:
export function Sidebar({ spaName, onLogout, mobileOpen, onMobileClose }: {
  spaName: string
  onLogout: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const pathname = usePathname()
  // ... rest stays the same, but use pathname for active detection:
  // active={pathname === item.href || (item.href === '/dashboard' && pathname === '/dashboard')}
}
```

Update the mobile drawer nav items to close drawer on click (use `<a>` with onClick):

```tsx
<a
  key={item.key}
  href={item.href}
  onClick={onMobileClose}
  className={/* same classes */}
>
```

- [ ] **Step 3: Update dashboard layout**

Since sidebar and mobile nav no longer need `currentPage` state, remove it from `DashboardShell` in `layout.tsx`. The active state is now derived from the URL automatically.

Simplified `DashboardShell`:

```typescript
function DashboardShell() {
  const { spa } = useContext(AuthContext)!
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await api.delete('/api/auth/login')
    } catch { /* ignore */ }
    localStorage.removeItem('spa_token')
    router.replace('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <Sidebar
          spaName={spa.name}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b bg-background/95 backdrop-blur-lg sticky top-0 z-30">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors" aria-label="Mở menu">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-1 ml-auto">
              <ThemeToggle />
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full pb-20 lg:pb-6">
            {children}
          </div>
          <footer className="hidden lg:block border-t py-3 px-6 text-center text-xs text-muted-foreground">
            Ghost Worker Dashboard © 2025
          </footer>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Test navigation on mobile and desktop**

1. Desktop sidebar: clicking links navigates to correct route, active state highlights based on URL
2. Mobile bottom nav: clicking links navigates to correct route, active state based on URL
3. Back button works correctly
4. Deep links work (e.g., `/dashboard/bookings` directly)
5. Mobile drawer: swiping closes drawer, tapping overlay closes drawer

- [ ] **Step 5: Commit**

```bash
git add src/components/mobile-bottom-nav.tsx src/components/sidebar.tsx src/app/dashboard/layout.tsx
git commit -m "refactor(fe): switch navigation from state-based to URL routing"
```

---

## Self-Review

**Spec coverage:**
- `/login` route (PIN auth) -> Task 1
- `/dashboard` (real-time overview) -> Task 2
- `/customers` (list + search) -> Task 3
- `/bookings` (tabs by status) -> Task 3
- `/pricing` (CRUD) -> Task 3
- `/settings` (spa config) -> Task 3
- `/chat-logs` (detailed history) -> Task 3
- Multi-branch support -> Tasks 4, 5
- Mobile navigation -> Task 6
- Auth guard on all routes -> Task 2 (AuthProvider)

**Placeholder scan:** No TBD/TODO. All code blocks reference actual existing code or provide complete implementations.

**Type consistency:**
- `spaId` from `useAuth()` hook used consistently across all panels.
- `branchFilter` state pattern identical in Dashboard, Bookings, Customers.
- API responses match actual shapes documented at the top of this plan.

**Actual codebase patterns preserved:**
- All inline SVGs (no lucide-react). deliberate choice: installed but not used, keep consistent until a deliberate migration.
- `getAuthHeaders()` sends Bearer token from localStorage. Browser sends httpOnly cookie automatically.
- `api` helper object with get/post/put/patch/delete methods.
- Toast notifications via `sonner`.
- shadcn/ui Dialog and AlertDialog for modals.

**Branch filtering correctness:**
- Bookings: direct `branchId` filter (Booking model has branchId).
- Dashboard: direct `branchId` filter (applies to bookings and chatLogs queries).
- Customers: subquery through bookings (Customer has no branchId).

**New files count:** 28 files
- 3 lib files (types, api, format)
- 1 hook (use-swipe)
- 1 hook (use-auth)
- 13 component files (auth-provider, login-form, sidebar, mobile-bottom-nav, header, stat-card, bar-chart, pagination, theme-toggle, dashboard-panel, customers-panel, bookings-panel, pricing-panel, chat-logs-panel, settings-panel)
- 7 route files (login, dashboard layout, dashboard page, 5 sub-route pages)

**Modified files count:** 5 files
- `src/app/page.tsx` (gutted to redirect)
- `src/components/dashboard-panel.tsx` (branch filter added)
- `src/components/bookings-panel.tsx` (branch filter added)
- `src/components/customers-panel.tsx` (branch filter added)
- `src/app/api/spa/[id]/dashboard/route.ts` (branchId param)
- `src/app/api/spa/[id]/bookings/route.ts` (branchId param)
- `src/app/api/spa/[id]/customers/route.ts` (branchId subquery)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-23-fe-owner-dashboard.md`. Two execution options:**

**1. Subagent-Driven (recommended)** -- I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** -- Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review

**Which approach?**
