'use client'

import { useState, useEffect, useContext, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { AuthContext } from './auth-provider'

interface MenuItem {
  id: string
  label: string
  href: string
  icon: string
  sort_order: number
  resource: string | null
  role: string
}

const ICONS: Record<string, React.ReactNode> = {
  home: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  cart: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  calendar: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  tag: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>,
  users: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  chat: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  staff: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  settings: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
}

// Group labels for sidebar sections
const SECTION_MAP: Record<string, string> = {
  home: 'Tổng quan',
  settings: 'Hệ thống',
}

function NavLink({ item, collapsed }: { item: MenuItem; collapsed: boolean }) {
  const pathname = usePathname()
  const isActive = item.href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group relative w-full flex items-center gap-3 rounded-md text-[13px] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
      } ${
        isActive
          ? 'font-semibold bg-accent text-accent-foreground'
          : 'font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <span className={`shrink-0 ${isActive ? 'text-foreground' : ''}`}>{ICONS[item.icon] || ICONS.home}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-foreground text-background text-xs font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
          {item.label}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ spaName, onLogout, mobileOpen, onMobileClose }: {
  spaName: string
  onLogout: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [footerOpen, setFooterOpen] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const auth = useContext(AuthContext)

  useEffect(() => {
    api.get('/api/sidebar-menu')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setMenuItems(res.data)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Close footer dropdown on outside click
  useEffect(() => {
    if (!footerOpen) return
    const handler = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setFooterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [footerOpen])

  if (!auth?.user) return null
  const { user } = auth

  // Group menu items by section
  const mainItems = menuItems.filter(i => !SECTION_MAP[i.icon] || i.icon === 'home' || i.icon === 'users' || i.icon === 'cart' || i.icon === 'calendar' || i.icon === 'tag' || i.icon === 'chat' || i.icon === 'staff')
  const systemItems = menuItems.filter(i => i.icon === 'settings')

  const userInitials = user.username
    ? user.username.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U'

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
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border shadow-xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground w-8 h-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-sm truncate">{spaName}</h2>
            <p className="text-[11px] text-sidebar-accent-foreground/60">Ghost Worker</p>
          </div>
          <button onClick={onMobileClose} className="p-2 -mr-2 rounded-md hover:bg-sidebar-accent transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {menuItems.map((item) => <NavLink key={item.id} item={item} collapsed={false} />)}
        </nav>
        {/* User footer */}
        <div className="px-3 py-3 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-foreground shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{user.username}</div>
              <div className="text-[11px] text-sidebar-accent-foreground/60 truncate">{user.role || 'Staff'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside
        className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ${
          collapsed ? 'w-[68px]' : 'w-[260px]'
        }`}
        style={{ height: '100dvh', position: 'sticky', top: 0 }}
      >
        {/* Brand */}
        <div className={`flex items-center border-b border-sidebar-border shrink-0 ${collapsed ? 'justify-center px-0 py-4' : 'px-5 gap-3 py-4'}`}>
          <div className="shrink-0 flex items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground w-8 h-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-sm truncate leading-tight">{spaName}</h2>
              <p className="text-[11px] text-sidebar-accent-foreground/60 leading-tight">Ghost Worker</p>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => <NavLink key={item.id} item={item} collapsed={collapsed} />)}
        </nav>

        {/* Footer — user profile dropdown */}
        <div ref={footerRef} className="shrink-0 border-t border-sidebar-border p-2 relative">
          <button
            onClick={() => setFooterOpen(!footerOpen)}
            className={`w-full flex items-center gap-3 rounded-md transition-colors duration-200 hover:bg-sidebar-accent ${collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'}`}
          >
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-[11px] font-semibold text-sidebar-foreground shrink-0">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-semibold truncate">{user.username}</div>
                <div className="text-[11px] text-sidebar-accent-foreground/60 truncate">{user.role || 'Staff'}</div>
              </div>
            )}
            {!collapsed && (
              <svg className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${footerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            )}
          </button>

          {/* Dropdown menu */}
          {footerOpen && (
            <div className={`absolute bottom-full mb-2 border border-border bg-popover rounded-lg shadow-xl z-50 py-1 min-w-[200px] ${collapsed ? 'left-full ml-2' : 'left-2 right-2'}`}>
              <button
                onClick={() => { setFooterOpen(false); setCollapsed(!collapsed) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <svg className="w-4 h-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
                {collapsed ? 'Mở rộng' : 'Thu gọn sidebar'}
              </button>
              <button
                onClick={() => { setFooterOpen(false); router.push('/dashboard/profile') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <svg className="w-4 h-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                Thông tin cá nhân
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => { setFooterOpen(false); onLogout() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
