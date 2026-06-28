'use client'

import { useState, useContext } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'
import { AuthProvider, AuthContext } from '@/components/auth-provider'
import { Sidebar } from '@/components/sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { spa } = useContext(AuthContext)!
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <DashboardShell>{children}</DashboardShell>
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
