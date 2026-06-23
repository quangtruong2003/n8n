'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster, toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

// ==================== TYPES ====================
interface SpaInfo {
  id: string
  name: string
  phone: string | null
  openTime: string | null
  closeTime: string | null
  botActive: boolean
  config: { botGreeting: string | null; botName: string | null } | null
  branches: { id: string; name: string; address: string | null }[]
}

type PageKey = 'dashboard' | 'customers' | 'bookings' | 'pricing' | 'settings' | 'chat-logs'

interface ServiceFormData {
  name: string
  price: string
  duration: string
  description: string
}

// ==================== API HELPERS ====================
function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('spa_token') : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

const api = {
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

// ==================== FORMAT HELPERS ====================
const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN').format(price) + 'đ'
const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN')
const formatDateTime = (d: string | Date) => new Date(d).toLocaleString('vi-VN')

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  completed: { label: 'Hoàn thành', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
}

// ==================== HOOK: SWIPE DETECTION ====================
function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50) {
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

// ==================== LOGIN COMPONENT ====================
function LoginForm({ onLogin }: { onLogin: (spa: SpaInfo) => void }) {
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

// ==================== NAVIGATION ====================
const NAV_ITEMS: { key: PageKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Tổng quan', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg> },
  { key: 'customers', label: 'Khách hàng', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
  { key: 'bookings', label: 'Đặt lịch', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg> },
  { key: 'pricing', label: 'Dịch vụ', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { key: 'chat-logs', label: 'Chat', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg> },
  { key: 'settings', label: 'Cài đặt', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
]

// ==================== NAV ITEM (with tooltip ref) ====================
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

// ==================== SIDEBAR (Desktop) + DRAWER (Mobile) ====================
function Sidebar({ currentPage, onPageChange, spaName, onLogout, mobileOpen, onMobileClose }: {
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
      {/* ===== MOBILE DRAWER ===== */}
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

      {/* ===== DESKTOP SIDEBAR ===== */}
      {/*
        Layout: flex-col, h-screen, shrink-0.
        Structure:
          - .sidebar-header  : fixed height, border-b
          - .sidebar-nav    : flex-1, overflow-y-auto (scrolls independently)
          - .sidebar-bottom  : fixed height, border-t, always visible
      */}
      <aside className={`hidden lg:flex flex-col bg-background transition-all duration-300 ease-out shrink-0 ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`} style={{ height: '100dvh', position: 'sticky', top: 0 }}>
        {/* Header — always at top */}
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

        {/* Nav — scrolls independently */}
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

        {/* Bottom — always at bottom */}
        <div className="shrink-0 border-t px-2.5 py-2 space-y-0.5">
          {/* Logout */}
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
          {/* Collapse toggle */}
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

// ==================== MOBILE BOTTOM NAV ====================
function MobileBottomNav({ currentPage, onPageChange }: { currentPage: PageKey; onPageChange: (p: PageKey) => void }) {
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

// ==================== HEADER ====================
function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

// ==================== STAT CARD ====================
function StatCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode }) {
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

// ==================== BAR CHART ====================
function BarChart({ data }: { data: { hour: number; count: number }[] }) {
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

// ==================== DASHBOARD PANEL ====================
function DashboardPanel({ spaId }: { spaId: string }) {
  const [data, setData] = useState<{
    stats: { messagesToday: number; newBookingsToday: number; pendingBookings: number; conversionRate: number }
    hourlyData: { hour: number; count: number }[]
    recentPendingBookings: {
      id: string; customerName: string; customerPhone: string; serviceName: string; servicePrice: number; branchName: string; bookingTime: string | null; status: string; note: string | null; createdAt: string
    }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/api/spa/${spaId}/dashboard`)
      setData(res)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [spaId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleBookingAction = async (bookingId: string, status: string) => {
    try {
      await api.patch(`/api/spa/${spaId}/bookings/${bookingId}`, { status })
      toast.success(status === 'confirmed' ? 'Đã xác nhận đặt lịch' : 'Đã hủy đặt lịch')
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Tổng quan" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-4 sm:p-5 animate-pulse">
              <div className="h-3 bg-muted rounded w-20 mb-3" />
              <div className="h-7 bg-muted rounded w-14" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <div>Không có dữ liệu</div>

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Tổng quan">
        <button onClick={fetchData} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 active:scale-95 transition-transform">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Làm mới
        </button>
      </Header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Tin nhắn hôm nay" value={data.stats.messagesToday} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>} />
        <StatCard title="Đặt lịch mới" value={data.stats.newBookingsToday} subtitle="Hôm nay" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>} />
        <StatCard title="Chờ xác nhận" value={data.stats.pendingBookings} subtitle="Cần xử lý" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard title="Tỷ lệ chuyển đổi" value={`${data.stats.conversionRate}%`} subtitle="Xác nhận + Hoàn thành" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>} />
      </div>

      <div className="bg-card border rounded-xl p-4 sm:p-5">
        <h3 className="font-semibold mb-3 text-sm sm:text-base">Tin nhắn theo giờ (hôm nay)</h3>
        <div className="h-48 sm:h-64">
          <BarChart data={data.hourlyData} />
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4 sm:p-5">
        <h3 className="font-semibold mb-3 text-sm sm:text-base">Đặt lịch chờ xác nhận</h3>
        {data.recentPendingBookings.length === 0 ? (
          <p className="text-muted-foreground text-sm">Không có đặt lịch chờ xác nhận</p>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {data.recentPendingBookings.map((b) => (
                <div key={b.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{b.customerName}</p>
                      <p className="text-xs text-muted-foreground">{b.customerPhone}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 shrink-0">Chờ xác nhận</span>
                  </div>
                  <p className="text-sm">{b.serviceName} · <span className="text-muted-foreground">{b.branchName}</span></p>
                  {b.bookingTime && <p className="text-xs text-muted-foreground">{formatDateTime(b.bookingTime)}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleBookingAction(b.id, 'confirmed')} className="flex-1 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-[0.97] transition-all font-medium">Xác nhận</button>
                    <button onClick={() => handleBookingAction(b.id, 'cancelled')} className="flex-1 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.97] transition-all font-medium">Hủy</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Khách</th>
                    <th className="pb-3 font-medium text-muted-foreground">Dịch vụ</th>
                    <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Chi nhánh</th>
                    <th className="pb-3 font-medium text-muted-foreground hidden lg:table-cell">Thời gian</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPendingBookings.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-3"><div className="font-medium">{b.customerName}</div><div className="text-xs text-muted-foreground">{b.customerPhone}</div></td>
                      <td className="py-3">{b.serviceName}</td>
                      <td className="py-3 hidden md:table-cell">{b.branchName}</td>
                      <td className="py-3 hidden lg:table-cell">{b.bookingTime ? formatDateTime(b.bookingTime) : '-'}</td>
                      <td className="py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleBookingAction(b.id, 'confirmed')} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 active:scale-95 transition-all">Xác nhận</button>
                          <button onClick={() => handleBookingAction(b.id, 'cancelled')} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 active:scale-95 transition-all">Hủy</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ==================== PAGINATION ====================
function Pagination({ pagination, onPrev, onNext }: { pagination: { total: number; page: number; totalPages: number }; onPrev: () => void; onNext: () => void }) {
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

// ==================== CUSTOMERS PANEL ====================
function CustomersPanel({ spaId }: { spaId: string }) {
  const [customers, setCustomers] = useState<unknown[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [customerDetail, setCustomerDetail] = useState<{ chatLogs: unknown[]; bookings: unknown[] } | null>(null)

  const fetchCustomers = useCallback(async (page: number, s: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), search: s })
      const res = await api.get(`/api/spa/${spaId}/customers?${params}`)
      setCustomers(res.customers)
      setPagination(res.pagination)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [spaId])

  useEffect(() => { fetchCustomers(1, search) }, [fetchCustomers, search])

  const handleSelectCustomer = async (c: { id: string; name: string; phone: string }) => {
    setSelectedCustomer(c)
    try {
      const res = await api.get(`/api/spa/${spaId}/customers/${c.id}`)
      setCustomerDetail(res)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải chi tiết')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Khách hàng" />

      <input
        type="text"
        placeholder="Tìm theo tên hoặc SĐT..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
      />

      {selectedCustomer ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedCustomer(null); setCustomerDetail(null) }} className="p-2 -ml-2 hover:bg-accent rounded-lg active:bg-accent/80 transition-colors" aria-label="Quay lại">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </button>
            <div>
              <h2 className="font-bold text-lg">{selectedCustomer.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
            </div>
          </div>

          {customerDetail ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-card border rounded-xl p-4 sm:p-5">
                <h3 className="font-semibold mb-3 text-sm">Lịch sử chat</h3>
                <div className="max-h-80 sm:max-h-96 overflow-y-auto space-y-2.5 pr-1">
                  {customerDetail.chatLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có tin nhắn</p>
                  ) : (
                    customerDetail.chatLogs.map((log: unknown) => {
                      const l = log as { id: string; sender: string; content: string; createdAt: string }
                      return (
                        <div key={l.id} className={`flex ${l.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[85%] sm:max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                            l.sender === 'user' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
                          }`}>
                            <p className="break-words">{l.content}</p>
                            <p className="text-[10px] mt-1 opacity-70">{formatDateTime(l.createdAt)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="bg-card border rounded-xl p-4 sm:p-5">
                <h3 className="font-semibold mb-3 text-sm">Lịch sử đặt lịch</h3>
                <div className="max-h-80 sm:max-h-96 overflow-y-auto space-y-2.5 pr-1">
                  {customerDetail.bookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có đặt lịch</p>
                  ) : (
                    customerDetail.bookings.map((b: unknown) => {
                      const bk = b as { id: string; serviceName: string; servicePrice: number; branchName: string; status: string; bookingTime: string | null; note: string | null; createdAt: string }
                      const st = statusMap[bk.status] || { label: bk.status, color: 'bg-gray-100 text-gray-800' }
                      return (
                        <div key={bk.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{bk.serviceName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${st.color}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatPrice(bk.servicePrice)} · {bk.branchName}</p>
                          {bk.bookingTime && <p className="text-xs text-muted-foreground mt-0.5">Giờ: {formatDateTime(bk.bookingTime)}</p>}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
      ) : (
        <>
          <div className="sm:hidden space-y-2">
            {customers.map((c: unknown) => {
              const cust = c as { id: string; name: string; phone: string; bookingCount: number; chatCount: number; createdAt: string }
              return (
                <button key={cust.id} onClick={() => handleSelectCustomer(cust)} className="w-full text-left bg-card border rounded-xl p-3.5 hover:bg-accent/50 active:bg-accent/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{cust.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cust.phone}</p>
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{cust.bookingCount} đặt lịch</span>
                    <span>{cust.chatCount} tin nhắn</span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tên</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">SĐT</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Đặt lịch</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Tin nhắn</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c: unknown) => {
                    const cust = c as { id: string; name: string; phone: string; bookingCount: number; chatCount: number; createdAt: string }
                    return (
                      <tr key={cust.id} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer active:bg-accent/80" onClick={() => handleSelectCustomer(cust)}>
                        <td className="px-4 py-3 font-medium">{cust.name}</td>
                        <td className="px-4 py-3">{cust.phone}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">{cust.bookingCount}</td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">{cust.chatCount}</td>
                        <td className="px-4 py-3 hidden xl:table-cell">{formatDate(cust.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && <Pagination pagination={pagination} onPrev={() => fetchCustomers(pagination.page - 1, search)} onNext={() => fetchCustomers(pagination.page + 1, search)} />}
          </div>
        </>
      )}
    </div>
  )
}

// ==================== BOOKINGS PANEL ====================
function BookingsPanel({ spaId }: { spaId: string }) {
  const [bookings, setBookings] = useState<unknown[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const fetchBookings = useCallback(async (page: number, status: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (status && status !== 'all') params.set('status', status)
      const res = await api.get(`/api/spa/${spaId}/bookings?${params}`)
      setBookings(res.bookings)
      setPagination(res.pagination)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [spaId])

  useEffect(() => { fetchBookings(1, statusFilter) }, [fetchBookings, statusFilter])

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      await api.patch(`/api/spa/${spaId}/bookings/${bookingId}`, { status: newStatus })
      toast.success('Cập nhật trạng thái thành công')
      fetchBookings(pagination.page, statusFilter)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật')
    }
  }

  const tabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Mới đặt' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'completed', label: 'Hoàn thành' },
    { key: 'cancelled', label: 'Đã hủy' },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Quản lý đặt lịch" />

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all active:scale-95 ${
              statusFilter === t.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
      ) : bookings.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Không có đặt lịch</div>
      ) : (
        <>
          <div className="sm:hidden space-y-2">
            {bookings.map((b: unknown) => {
              const bk = b as { id: string; customerName: string; customerPhone: string; serviceName: string; servicePrice: number; branchName: string; status: string; bookingTime: string | null }
              const st = statusMap[bk.status] || { label: bk.status, color: 'bg-gray-100 text-gray-800' }
              return (
                <div key={bk.id} className="bg-card border rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{bk.customerName}</p>
                      <p className="text-xs text-muted-foreground">{bk.customerPhone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-sm">{bk.serviceName} · <span className="text-muted-foreground">{formatPrice(bk.servicePrice)}</span></p>
                  <p className="text-xs text-muted-foreground">{bk.branchName}{bk.bookingTime ? ` · ${formatDateTime(bk.bookingTime)}` : ''}</p>
                  <select
                    value={bk.status}
                    onChange={(e) => handleStatusChange(bk.id, e.target.value)}
                    className="w-full h-9 text-xs border rounded-lg px-2 bg-background"
                  >
                    <option value="pending">Chờ xác nhận</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
              )
            })}
          </div>
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Khách</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dịch vụ</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Chi nhánh</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Thời gian</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: unknown) => {
                    const bk = b as { id: string; customerName: string; customerPhone: string; serviceName: string; servicePrice: number; branchName: string; status: string; bookingTime: string | null }
                    const st = statusMap[bk.status] || { label: bk.status, color: 'bg-gray-100 text-gray-800' }
                    return (
                      <tr key={bk.id} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="px-4 py-3"><div className="font-medium">{bk.customerName}</div><div className="text-xs text-muted-foreground">{bk.customerPhone}</div></td>
                        <td className="px-4 py-3"><div>{bk.serviceName}</div><div className="text-xs text-muted-foreground">{formatPrice(bk.servicePrice)}</div></td>
                        <td className="px-4 py-3 hidden md:table-cell">{bk.branchName}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">{bk.bookingTime ? formatDateTime(bk.bookingTime) : '-'}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                        <td className="px-4 py-3 text-right">
                          <select value={bk.status} onChange={(e) => handleStatusChange(bk.id, e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
                            <option value="pending">Chờ xác nhận</option>
                            <option value="confirmed">Đã xác nhận</option>
                            <option value="completed">Hoàn thành</option>
                            <option value="cancelled">Đã hủy</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && <Pagination pagination={pagination} onPrev={() => fetchBookings(pagination.page - 1, statusFilter)} onNext={() => fetchBookings(pagination.page + 1, statusFilter)} />}
          </div>
        </>
      )}
    </div>
  )
}

// ==================== PRICING PANEL — CRUD WITH DIALOGS ====================

interface Service {
  id: string
  name: string
  price: number
  duration: number | null
  description: string | null
  active: boolean
}

function ServiceAddDialog({ spaId, open, onClose, onSuccess }: { spaId: string; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<ServiceFormData>({ name: '', price: '', duration: '', description: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.price) { toast.error('Tên và giá là bắt buộc'); return }
    setSaving(true)
    try {
      await api.post(`/api/spa/${spaId}/services`, form)
      toast.success('Thêm dịch vụ thành công')
      setForm({ name: '', price: '', duration: '', description: '' })
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi thêm dịch vụ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setForm({ name: '', price: '', duration: '', description: '' }); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm dịch vụ mới</DialogTitle>
          <DialogDescription>Điền thông tin dịch vụ bên dưới.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tên dịch vụ <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="VD: Massage body"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Giá (VNĐ) <span className="text-red-500">*</span></label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="VD: 350000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Thời lượng (phút)</label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="VD: 60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mô tả</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              placeholder="Mô tả ngắn về dịch vụ"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="px-4 py-2 border rounded-lg text-sm hover:bg-accent active:scale-[0.97] transition-all">Hủy</button>
          </DialogClose>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 active:scale-[0.97] transition-all">
            {saving ? 'Đang lưu...' : 'Thêm dịch vụ'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ServiceEditDialog({ spaId, service, open, onClose, onSuccess }: { spaId: string; service: Service | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<ServiceFormData>({ name: '', price: '', duration: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name,
        price: String(service.price),
        duration: service.duration ? String(service.duration) : '',
        description: service.description || '',
      })
    }
  }, [service])

  const handleSubmit = async () => {
    if (!form.name || !form.price || !service) return
    setSaving(true)
    try {
      await api.put(`/api/spa/${spaId}/services/${service.id}`, form)
      toast.success('Cập nhật dịch vụ thành công')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa dịch vụ</DialogTitle>
          <DialogDescription>Cập nhật thông tin dịch vụ "{service?.name}".</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tên dịch vụ <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Giá (VNĐ) <span className="text-red-500">*</span></label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Thời lượng (phút)</label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="VD: 60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mô tả</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="px-4 py-2 border rounded-lg text-sm hover:bg-accent active:scale-[0.97] transition-all">Hủy</button>
          </DialogClose>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 active:scale-[0.97] transition-all">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ServiceDeleteDialog({ spaId, service, open, onClose, onSuccess }: { spaId: string; service: Service | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!service) return
    setDeleting(true)
    try {
      await api.delete(`/api/spa/${spaId}/services/${service.id}`)
      toast.success('Đã xóa dịch vụ')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xóa dịch vụ')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa dịch vụ?</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc muốn xóa dịch vụ "{service?.name}"? Hành động này không thể hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <button className="px-4 py-2 border rounded-lg text-sm hover:bg-accent active:scale-[0.97] transition-all">Hủy bỏ</button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              {deleting ? 'Đang xóa...' : 'Xóa dịch vụ'}
            </button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PricingPanel({ spaId }: { spaId: string }) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [deleteService, setDeleteService] = useState<Service | null>(null)

  const fetchServices = useCallback(async () => {
    try {
      const res = await api.get(`/api/spa/${spaId}/services`)
      setServices(res.services)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dịch vụ')
    } finally {
      setLoading(false)
    }
  }, [spaId])

  useEffect(() => { fetchServices() }, [fetchServices])

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Dịch vụ & Giá">
        <button
          onClick={() => setAddOpen(true)}
          className="px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
        >
          + Thêm dịch vụ
        </button>
      </Header>

      {/* Dialogs */}
      <ServiceAddDialog spaId={spaId} open={addOpen} onClose={() => setAddOpen(false)} onSuccess={fetchServices} />
      <ServiceEditDialog spaId={spaId} service={editService} open={!!editService} onClose={() => setEditService(null)} onSuccess={fetchServices} />
      <ServiceDeleteDialog spaId={spaId} service={deleteService} open={!!deleteService} onClose={() => setDeleteService(null)} onSuccess={fetchServices} />

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
      ) : services.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <p>Chưa có dịch vụ nào.</p>
          <button onClick={() => setAddOpen(true)} className="mt-2 text-primary hover:underline text-sm">Thêm dịch vụ đầu tiên</button>
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-2">
            {services.map((svc) => (
              <div key={svc.id} className="bg-card border rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{svc.name}</p>
                    <p className="text-sm text-primary font-semibold mt-0.5">{formatPrice(svc.price)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setEditService(svc)} className="p-2 border rounded-lg hover:bg-accent active:bg-accent/80 transition-colors" aria-label="Sửa">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                    </button>
                    <button onClick={() => setDeleteService(svc)} className="p-2 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 transition-colors" aria-label="Xóa">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>
                {svc.duration && <p className="text-xs text-muted-foreground mt-1">{svc.duration} phút</p>}
                {svc.description && <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>}
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tên dịch vụ</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Giá</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Thời lượng</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Mô tả</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => (
                    <tr key={svc.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-3 font-medium">{svc.name}</td>
                      <td className="px-4 py-3">{formatPrice(svc.price)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{svc.duration ? `${svc.duration} phút` : '-'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{svc.description || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditService(svc)} className="px-3 py-1 text-xs border rounded-md hover:bg-accent active:scale-[0.97] transition-all">Sửa</button>
                          <button onClick={() => setDeleteService(svc)} className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-[0.97] transition-all">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ==================== CHAT LOGS PANEL ====================
function ChatLogsPanel({ spaId }: { spaId: string }) {
  const [logs, setLogs] = useState<unknown[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [senderFilter, setSenderFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionLogs, setSessionLogs] = useState<unknown[]>([])

  const fetchLogs = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (dateFilter) params.set('date', dateFilter)
      if (senderFilter) params.set('sender', senderFilter)
      if (branchFilter) params.set('branchId', branchFilter)
      const res = await api.get(`/api/spa/${spaId}/chat-logs?${params}`)
      setLogs(res.logs)
      setPagination(res.pagination)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [spaId, dateFilter, senderFilter, branchFilter])

  useEffect(() => { fetchLogs(1) }, [fetchLogs])

  useEffect(() => {
    api.get(`/api/spa/${spaId}/branches`).then((res) => setBranches(res.branchs || res.branches || [])).catch(() => {})
  }, [spaId])

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      return
    }
    setExpandedSession(sessionId)
    try {
      const res = await api.get(`/api/spa/${spaId}/chat-logs/${sessionId}`)
      setSessionLogs(res.logs)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải chi tiết')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Chat Logs" />

      <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm col-span-2 sm:col-span-1" />
        <select value={senderFilter} onChange={(e) => setSenderFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm">
          <option value="">Tất cả loại</option>
          <option value="user">Khách gửi</option>
          <option value="bot">Bot phản hồi</option>
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm col-span-2 sm:col-span-1">
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={() => fetchLogs(1)} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 active:scale-[0.97] transition-all">Lọc</button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Không có dữ liệu</div>
      ) : (
        <>
          <div className="sm:hidden space-y-2">
            {logs.map((l: unknown) => {
              const log = l as { id: string; customerName: string; customerPhone: string; branchName: string; sender: string; content: string; sessionId: string | null; createdAt: string }
              return (
                <div key={log.id} className="bg-card border rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{log.customerName}</p>
                      <p className="text-xs text-muted-foreground">{log.customerPhone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${log.sender === 'user' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                      {log.sender === 'user' ? 'Khách' : 'Bot'}
                    </span>
                  </div>
                  <p className="text-sm break-words line-clamp-2">{log.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                    {log.sessionId && (
                      <button onClick={() => handleExpandSession(log.sessionId!)} className="text-xs text-primary hover:underline active:opacity-70 transition-opacity">
                        {expandedSession === log.sessionId ? 'Ẩn' : 'Xem hội thoại'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Khách</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Loại</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nội dung</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Chi nhánh</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Thời gian</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: unknown) => {
                    const log = l as { id: string; customerName: string; customerPhone: string; branchName: string; sender: string; content: string; sessionId: string | null; createdAt: string }
                    return (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="px-4 py-3"><div className="font-medium">{log.customerName}</div><div className="text-xs text-muted-foreground">{log.customerPhone}</div></td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${log.sender === 'user' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{log.sender === 'user' ? 'Khách' : 'Bot'}</span></td>
                        <td className="px-4 py-3 max-w-xs truncate">{log.content}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">{log.branchName}</td>
                        <td className="px-4 py-3 hidden md:table-cell">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3 text-right">{log.sessionId && <button onClick={() => handleExpandSession(log.sessionId!)} className="text-xs text-primary hover:underline">{expandedSession === log.sessionId ? 'Ẩn' : 'Xem'}</button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && <Pagination pagination={pagination} onPrev={() => fetchLogs(pagination.page - 1)} onNext={() => fetchLogs(pagination.page + 1)} />}
          </div>

          {expandedSession && (
            <div className="bg-card border rounded-xl p-4 sm:p-5 ring-2 ring-primary/20">
              <h4 className="font-semibold mb-3 text-sm">Hội thoại chi tiết</h4>
              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {sessionLogs.map((l: unknown) => {
                  const log = l as { id: string; sender: string; content: string; customerName: string; createdAt: string }
                  return (
                    <div key={log.id} className={`flex ${log.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                        log.sender === 'user' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
                      }`}>
                        <p className="break-words">{log.content}</p>
                        <p className="text-[10px] mt-1 opacity-70">{log.sender === 'user' ? log.customerName : 'Bot'} · {formatDateTime(log.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ==================== SETTINGS PANEL ====================
function SettingsPanel({ spa, onUpdate }: { spa: SpaInfo; onUpdate: (s: SpaInfo) => void }) {
  const [form, setForm] = useState({
    name: spa.name,
    phone: spa.phone || '',
    openTime: spa.openTime || '08:00',
    closeTime: spa.closeTime || '22:00',
    botActive: spa.botActive,
    botGreeting: spa.config?.botGreeting || '',
    botName: spa.config?.botName || 'CS Bot',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/api/spa/${spa.id}/config`, form)
      const meData = await api.get('/api/auth/me')
      onUpdate(meData.spa)
      toast.success('Lưu cài đặt thành công')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu cài đặt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Cài đặt" />

      <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-6">
        <div>
          <h3 className="font-semibold mb-4 text-sm">Thông tin Spa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Tên Spa</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">SĐT chủ</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Giờ mở cửa</label>
              <input type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Giờ đóng cửa</label>
              <input type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4 text-sm">Cấu hình Bot</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">Bật/Tắt Bot</p>
                <p className="text-xs text-muted-foreground">Khi tắt, bot sẽ ngừng phản hồi</p>
              </div>
              <button
                onClick={() => setForm({ ...form, botActive: !form.botActive })}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 active:scale-95 transition-all ${
                  form.botActive ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={form.botActive}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${form.botActive ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Tên Bot</label>
              <input value={form.botName} onChange={(e) => setForm({ ...form, botName: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Lời chào Bot</label>
              <textarea value={form.botGreeting} onChange={(e) => setForm({ ...form, botGreeting: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none" />
            </div>
          </div>
        </div>

        {spa.branches.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4 text-sm">Chi nhánh</h3>
            <div className="space-y-2">
              {spa.branches.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{b.name}</p>
                    {b.address && <p className="text-xs text-muted-foreground truncate">{b.address}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 active:scale-[0.97] transition-all">
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== THEME TOGGLE ====================
function ThemeToggle() {
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

// ==================== MAIN APP ====================
function AppContent() {
  const [spa, setSpa] = useState<SpaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await api.get('/api/auth/me')
        setSpa(data.spa)
      } catch {
        // Not authenticated
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  const handleLogout = async () => {
    try {
      await api.delete('/api/auth/login')
    } catch {
      // ignore
    }
    localStorage.removeItem('spa_token')
    setSpa(null)
    toast.success('Đã đăng xuất')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!spa) {
    return <LoginForm onLogin={setSpa} />
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
            {currentPage === 'dashboard' && <DashboardPanel spaId={spa.id} />}
            {currentPage === 'customers' && <CustomersPanel spaId={spa.id} />}
            {currentPage === 'bookings' && <BookingsPanel spaId={spa.id} />}
            {currentPage === 'pricing' && <PricingPanel spaId={spa.id} />}
            {currentPage === 'chat-logs' && <ChatLogsPanel spaId={spa.id} />}
            {currentPage === 'settings' && <SettingsPanel spa={spa} onUpdate={setSpa} />}
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

// ==================== PAGE EXPORT ====================
export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AppContent />
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
