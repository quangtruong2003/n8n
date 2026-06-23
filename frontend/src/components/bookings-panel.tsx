'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatPrice, formatDateTime, statusMap } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

export function BookingsPanel({ spaId }: { spaId: string }) {
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [bookings, setBookings] = useState<unknown[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/spa/${spaId}/branches`).then((res) => {
      setBranches(res.branches || [])
    }).catch(() => {})
  }, [spaId])

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
