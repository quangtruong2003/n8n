'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Header } from '@/components/header'
import { StatCard } from '@/components/stat-card'
import { BarChart } from '@/components/bar-chart'

export function DashboardPanel({ spaId }: { spaId: string }) {
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [data, setData] = useState<{
    stats: { messagesToday: number; newBookingsToday: number; pendingBookings: number; conversionRate: number }
    hourlyData: { hour: number; count: number }[]
    recentPendingBookings: {
      id: string; customerName: string; customerPhone: string; serviceName: string; servicePrice: number; branchName: string; bookingTime: string | null; status: string; note: string | null; createdAt: string
    }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/spa/${spaId}/branches`).then((res) => {
      setBranches(res.branches || [])
    }).catch(() => {})
  }, [spaId])

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
