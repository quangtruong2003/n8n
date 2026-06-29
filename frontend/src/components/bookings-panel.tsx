'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

interface Booking {
  id: string
  customer_name: string
  customer_phone: string
  branch_name: string
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  booking_start: string
  booking_end: string
  note: string | null
  order_id: string | null
  order_code: string | null
  items: Array<{
    product_name: string
    price: number
    quantity: number
  }>
}

export function BookingsPanel() {
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  // Booking Create State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; full_name: string; phone: string | null }[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingStart, setBookingStart] = useState('')
  const [bookingEnd, setBookingEnd] = useState('')
  const [note, setNote] = useState('')

  // Availability check state
  const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  useEffect(() => {
    api.get('/api/branches').then((res) => {
      setBranches(res.data || [])
      if (res.data && res.data.length > 0) {
        setSelectedBranchId(res.data[0].id)
      }
    }).catch(() => {})
  }, [])

  const fetchBookings = useCallback(async (page: number, status: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (status && status !== 'all') params.set('status', status)
      if (branchFilter) params.set('branch_id', branchFilter)
      const res = await api.get(`/api/bookings?${params}`)
      setBookings(res.data || [])
      if (res.meta) {
        setPagination(res.meta)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [branchFilter])

  useEffect(() => {
    fetchBookings(1, statusFilter)
  }, [fetchBookings, statusFilter])

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/status`, { status: newStatus })
      toast.success('Cập nhật trạng thái thành công')

      if (newStatus === 'completed' && res.data?.order_id) {
        toast.success(`Hóa đơn ORD đã tự động được tạo!`, {
          description: `Linked Order ID: ${res.data.order_id}`,
          duration: 10000,
        })
      }

      fetchBookings(pagination.page, statusFilter)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật')
    }
  }

  // Fetch busy slots when branch, date or product selection changes
  useEffect(() => {
    if (!selectedBranchId || !bookingDate) {
      setBusySlots([])
      return
    }

    const checkAvailability = async () => {
      setCheckingAvailability(true)
      try {
        const params = new URLSearchParams({
          branch_id: selectedBranchId,
          date: bookingDate
        })
        if (selectedProductId) params.set('product_id', selectedProductId)

        const res = await api.get(`/api/bookings/availability?${params}`)
        setBusySlots(res.data || [])
      } catch {
        // Silent error
      } finally {
        setCheckingAvailability(false)
      }
    }

    checkAvailability()
  }, [selectedBranchId, bookingDate, selectedProductId])

  const handleOpenCreateModal = async () => {
    setShowCreateModal(true)
    try {
      const custRes = await api.get('/api/customers?limit=100')
      setCustomers(custRes.data || [])

      const prodRes = await api.get('/api/products?type=service&active=1&limit=100')
      setProducts(prodRes.data || [])
      if (prodRes.data && prodRes.data.length > 0) {
        setSelectedProductId(prodRes.data[0].id)
      }
    } catch {
      toast.error('Lỗi tải dữ liệu khởi tạo')
    }
  }

  const handleCreateBooking = async () => {
    if (!selectedBranchId || !selectedCustomerId || !selectedProductId || !bookingDate || !bookingStart || !bookingEnd) {
      toast.error('Vui lòng điền đầy đủ thông tin')
      return
    }

    const startDateTime = `${bookingDate}T${bookingStart}:00`
    const endDateTime = `${bookingDate}T${bookingEnd}:00`

    if (new Date(startDateTime) >= new Date(endDateTime)) {
      toast.error('Thời gian bắt đầu phải trước thời gian kết thúc')
      return
    }

    // Client-side overlap validation
    const hasOverlap = busySlots.some(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      const reqStart = new Date(startDateTime)
      const reqEnd = new Date(endDateTime)
      return reqStart < slotEnd && reqEnd > slotStart
    })

    if (hasOverlap) {
      toast.error('Khung giờ này đã bị trùng lịch, vui lòng chọn giờ khác!')
      return
    }

    try {
      const res = await api.post('/api/bookings', {
        branch_id: selectedBranchId,
        customer_id: selectedCustomerId,
        booking_start: startDateTime,
        booking_end: endDateTime,
        note: note || null,
        items: [{
          product_id: selectedProductId,
          quantity: 1
        }]
      })

      if (res.success) {
        toast.success('Đặt lịch thành công')
        setShowCreateModal(false)
        setBookingDate('')
        setBookingStart('')
        setBookingEnd('')
        setNote('')
        fetchBookings(1, statusFilter)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tạo lịch hẹn')
    }
  }

  const tabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'in_progress', label: 'Đang thực hiện' },
    { key: 'completed', label: 'Hoàn thành' },
    { key: 'cancelled', label: 'Đã hủy' },
    { key: 'no_show', label: 'Không đến' }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-purple-100 text-purple-800'
      case 'no_show': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Hoàn thành'
      case 'cancelled': return 'Đã hủy'
      case 'confirmed': return 'Đã xác nhận'
      case 'in_progress': return 'Đang thực hiện'
      case 'no_show': return 'Không đến'
      default: return 'Chờ xác nhận'
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Header title="Quản lý đặt lịch" />
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all self-start sm:self-auto"
        >
          Đặt lịch mới
        </button>
      </div>

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
          <button
            onClick={() => fetchBookings(1, statusFilter)}
            className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 active:scale-[0.97] transition-all"
          >
            Lọc
          </button>
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
        <div className="p-8 text-center text-muted-foreground border rounded-xl">Đang tải...</div>
      ) : bookings.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl">Không có lịch hẹn nào</div>
      ) : (
        <>
          <div className="sm:hidden space-y-2">
            {bookings.map((bk) => (
              <div key={bk.id} className="bg-card border rounded-xl p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{bk.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{bk.customer_phone}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(bk.status)}`}>
                    {getStatusLabel(bk.status)}
                  </span>
                </div>
                <div className="text-sm">
                  {bk.items.map((item, idx) => (
                    <div key={idx}>
                      {item.product_name} · <span className="text-muted-foreground">{formatCurrency(item.price)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bk.branch_name} · {formatDateTime(bk.booking_start)}
                </p>
                {bk.order_id && (
                  <p className="text-xs text-green-600 font-semibold bg-green-50 dark:bg-green-950/20 p-2 rounded-lg">
                    Liên kết đơn: <span className="underline">{bk.order_code || bk.order_id}</span>
                  </p>
                )}
                <select
                  value={bk.status}
                  onChange={(e) => handleStatusChange(bk.id, e.target.value)}
                  className="w-full h-9 text-xs border rounded-lg px-2 bg-background"
                  disabled={bk.status === 'completed' || bk.status === 'cancelled'}
                >
                  <option value="pending">Chờ xác nhận</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="in_progress">Đang thực hiện</option>
                  <option value="completed">Hoàn thành (Auto Order)</option>
                  <option value="cancelled">Đã hủy</option>
                  <option value="no_show">Không đến</option>
                </select>
              </div>
            ))}
          </div>

          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden shadow-sm">
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
                  {bookings.map((bk) => (
                    <tr key={bk.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{bk.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{bk.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        {bk.items.map((item, idx) => (
                          <div key={idx}>
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(item.price)}</div>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{bk.branch_name}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {formatDateTime(bk.booking_start)}
                        <div className="text-[10px] text-muted-foreground">đến {bk.booking_end.split('T')[1]?.substring(0, 5)}</div>
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(bk.status)}`}>
                          {getStatusLabel(bk.status)}
                        </span>
                        {bk.order_id && (
                          <div className="text-[10px] text-green-600 font-semibold">
                            Hóa đơn: {bk.order_code || 'Liên kết'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          value={bk.status}
                          onChange={(e) => handleStatusChange(bk.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1 bg-background"
                          disabled={bk.status === 'completed' || bk.status === 'cancelled'}
                        >
                          <option value="pending">Chờ xác nhận</option>
                          <option value="confirmed">Đã xác nhận</option>
                          <option value="in_progress">Đang thực hiện</option>
                          <option value="completed">Hoàn thành (Auto Order)</option>
                          <option value="cancelled">Đã hủy</option>
                          <option value="no_show">Không đến</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && (
              <Pagination
                pagination={pagination}
                onPrev={() => fetchBookings(pagination.page - 1, statusFilter)}
                onNext={() => fetchBookings(pagination.page + 1, statusFilter)}
              />
            )}
          </div>
        </>
      )}

      {/* CREATE BOOKING MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]">
          <div className="bg-background border rounded-xl max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Đặt lịch hẹn mới</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Chọn chi nhánh</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Khách hàng</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="">Chọn khách hàng...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Dịch vụ</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ngày đặt hẹn</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={bookingStart}
                    onChange={(e) => setBookingStart(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Giờ kết thúc</label>
                  <input
                    type="time"
                    value={bookingEnd}
                    onChange={(e) => setBookingEnd(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
              </div>

              {/* Busy Slots Panel */}
              {bookingDate && (
                <div className="bg-muted/40 p-3 rounded-lg space-y-1.5">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">Giờ bận chi nhánh ngày này</h4>
                  {checkingAvailability ? (
                    <p className="text-xs text-muted-foreground animate-pulse">Đang kiểm tra rảnh/bận...</p>
                  ) : busySlots.length === 0 ? (
                    <p className="text-xs text-green-600 font-semibold">Tất cả khung giờ đều trống!</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {busySlots.map((slot, idx) => {
                        const start = slot.start.split('T')[1]?.substring(0, 5)
                        const end = slot.end.split('T')[1]?.substring(0, 5)
                        return (
                          <span key={idx} className="text-[10px] px-2 py-0.5 bg-red-100 text-red-800 rounded font-medium">
                            {start} - {end}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ghi chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-accent"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateBooking}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Đặt lịch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
