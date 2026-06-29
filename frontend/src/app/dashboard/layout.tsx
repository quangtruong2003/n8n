'use client'

import { useState, useContext, useEffect } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'
import { AuthProvider, AuthContext } from '@/components/auth-provider'
import { Sidebar } from '@/components/sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { CommandMenu } from '@/components/command-menu'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!auth || !auth.user) return null

  const { spa, user } = auth

  const handleLogout = async () => {
    try {
      await api.delete('/api/auth/login')
    } catch {
      // ignore
    }
    localStorage.removeItem('session_token')
    router.replace('/login')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="flex flex-1">
        <Sidebar
          spaName={spa?.name || 'Ghost Worker'}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Topbar */}
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b bg-background/95 backdrop-blur-lg sticky top-0 z-30 transition-colors duration-200">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-md border border-border hover:bg-accent transition-colors"
                aria-label="Mở menu"
              >
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              {/* Search Trigger */}
              <button
                onClick={() => setCmdOpen(true)}
                className="hidden sm:flex items-center gap-3 px-3 py-1.5 border border-border rounded-md text-sm text-muted-foreground hover:border-foreground/20 transition-colors w-[260px] cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <span className="flex-1 text-left">Tìm kiếm…</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button className="relative p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" aria-label="Thông báo">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full pb-20 lg:pb-6">
            {children}
          </div>
          <footer className="hidden lg:block border-t py-3 px-6 text-center text-xs text-muted-foreground">
            Ghost Worker Dashboard © 2025
          </footer>
        </main>
      </div>
      <MobileBottomNav />
      <CommandMenu open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DashboardShell>{children}</DashboardShell>
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
