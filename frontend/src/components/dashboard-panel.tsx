'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { Header } from '@/components/header'
import { StatCard } from '@/components/stat-card'

interface DashboardStats {
  pendingBookings: number
  activeOrders: number
  unresolvedChatSessions: number
  totalCustomers: number
}

interface PendingBooking {
  id: string
  customer_name: string
  customer_phone: string
  items: Array<{ product_name: string; price: number }>
  branch_name: string
  booking_start: string
  status: string
  order_id: string | null
}

interface ActiveChatSession {
  id: string
  customer_name: string
  channel: string
  last_message_at: string
  status: string
  last_message_preview: string
}

export function DashboardPanel() {
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([])
  const [activeChatSessions, setActiveChatSessions] = useState<ActiveChatSession[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      // Fetch branches
      const branchRes = await api.get('/api/branches')
      setBranches(branchRes.data || [])

      // Fetch pending bookings
      const bookingParams = new URLSearchParams({ status: 'pending', limit: '10' })
      if (branchFilter) bookingParams.set('branch_id', branchFilter)
      const bookingRes = await api.get(`/api/bookings?${bookingParams}`)
      setPendingBookings(bookingRes.data || [])

      // Fetch active chat sessions (bot_handling + active)
      const chatRes = await api.get('/api/chat/sessions?status=active&limit=10')
      setActiveChatSessions(chatRes.data || [])

      // Stats are derived
      setStats({
        pendingBookings: bookingRes.meta?.total || (bookingRes.data || []).length,
        activeOrders: 0, // Could be fetched separately
        unresolvedChatSessions: chatRes.meta?.total || (chatRes.data || []).length,
        totalCustomers: 0 // Could be fetched separately
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [branchFilter])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleBookingAction = async (bookingId: string, status: string) => {
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/status`, { status })
      toast.success(status === 'confirmed' ? 'Đã xác nhận đặt lịch' : 'Đã hủy đặt lịch')

      if (status === 'completed' && res.data?.order_id) {
        toast.success('Hóa đơn ORD đã tự động được tạo!', { duration: 8000 })
      }

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

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Đặt lịch chờ xử lý"
            value={stats.pendingBookings}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            title="Chat cần hỗ trợ"
            value={stats.unresolvedChatSessions}
            subtitle="Takeover từ Bot"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>}
          />
          <StatCard
            title="Đơn hàng mới"
            value={stats.activeOrders}
            subtitle="Chờ xử lý"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>}
          />
          <StatCard
            title="Khách hàng"
            value={stats.totalCustomers}
            subtitle="Trong hệ thống"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Bookings */}
        <div className="bg-card border rounded-xl p-4 sm:p-5 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm sm:text-base">Đặt lịch chờ xác nhận</h3>
          {pendingBookings.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Không có đặt lịch chờ xác nhận</p>
          ) : (
            <div className="space-y-2.5">
              {pendingBookings.map((b) => (
                <div key={b.id} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{b.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{b.customer_phone || 'Chưa có SĐT'}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 shrink-0 font-semibold">Chờ</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Array.isArray(b.items) && b.items.length > 0 ? b.items.map((item: any, i: number) => (
                      <span key={i}>{item.product_name}{i < b.items.length - 1 ? ', ' : ''}</span>
                    )) : <span className="italic">Chưa có dịch vụ</span>}
                    · {b.branch_name}
                  </div>
                  {b.booking_start && <p className="text-[10px] text-muted-foreground">{formatDateTime(b.booking_start)}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleBookingAction(b.id, 'confirmed')} className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-[0.97] transition-all font-medium">Xác nhận</button>
                    <button onClick={() => handleBookingAction(b.id, 'cancelled')} className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.97] transition-all font-medium">Hủy</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Chat Sessions */}
        <div className="bg-card border rounded-xl p-4 sm:p-5 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm sm:text-base">Chat cần hỗ trợ</h3>
          {activeChatSessions.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Không có chat cần hỗ trợ</p>
          ) : (
            <div className="space-y-2.5">
              {activeChatSessions.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{s.customer_name || 'Khách ẩn danh'}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        s.channel === 'zalo' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {s.channel === 'zalo' ? 'Zalo' : 'Web'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{s.last_message_preview || '...'}</p>
                  </div>
                  <a href="/dashboard/chat-logs" className="px-3 py-1.5 text-xs border border-input rounded-lg hover:bg-accent shrink-0 font-semibold">
                    Xem
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
