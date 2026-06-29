'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

interface Customer {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  gender: string | null
  tags: string[]
  total_spent: number
  total_bookings: number
  last_visit_at: string | null
  created_at: string
}

interface CustomerNote {
  id: string
  content: string
  created_by_name: string
  created_at: string
}

export function CustomersPanel() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formGender, setFormGender] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchCustomers = useCallback(async (page: number, s: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (s) params.set('search', s)
      const res = await api.get(`/api/customers?${params}`)
      setCustomers(res.data || [])
      if (res.meta) setPagination(res.meta)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(1, search), 300)
    return () => clearTimeout(t)
  }, [fetchCustomers, search])

  const handleSelectCustomer = async (c: Customer) => {
    setSelectedCustomer(c)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/api/customers/${c.id}`)
      if (res.success && res.data) {
        setSelectedCustomer(res.data)
        setCustomerNotes(res.data.notes || [])
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải chi tiết')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedCustomer || !newNote.trim()) return
    setSubmittingNote(true)
    try {
      const res = await api.post(`/api/customers/${selectedCustomer.id}/notes`, {
        content: newNote.trim()
      })
      if (res.success) {
        setCustomerNotes([...customerNotes, res.data])
        setNewNote('')
        toast.success('Đã thêm ghi chú')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi thêm ghi chú')
    } finally {
      setSubmittingNote(false)
    }
  }

  const handleOpenCreateModal = () => {
    setEditCustomer(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormGender('')
    setShowModal(true)
  }

  const handleOpenEditModal = (c: Customer) => {
    setEditCustomer(c)
    setFormName(c.full_name)
    setFormPhone(c.phone || '')
    setFormEmail(c.email || '')
    setFormGender(c.gender || '')
    setShowModal(true)
  }

  const handleSaveCustomer = async () => {
    if (!formName.trim()) {
      toast.error('Vui lòng nhập tên khách hàng')
      return
    }
    setSubmitting(true)
    try {
      if (editCustomer) {
        const res = await api.put(`/api/customers/${editCustomer.id}`, {
          name: formName.trim(),
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          gender: formGender || null
        })
        if (res.success) {
          toast.success('Cập nhật khách hàng thành công')
          setSelectedCustomer({ ...selectedCustomer!, full_name: formName, phone: formPhone, email: formEmail, gender: formGender } as any)
        }
      } else {
        const res = await api.post('/api/customers', {
          name: formName.trim(),
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          gender: formGender || null
        })
        if (res.success) toast.success('Tạo khách hàng thành công')
      }
      setShowModal(false)
      fetchCustomers(pagination.page, search)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu thông tin')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Header title="Quản lý khách hàng" />
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all self-start sm:self-auto"
        >
          Thêm khách hàng mới
        </button>
      </div>

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
            <button onClick={() => { setSelectedCustomer(null); setCustomerNotes([]) }} className="p-2 -ml-2 hover:bg-accent rounded-lg active:bg-accent/80 transition-colors" aria-label="Quay lại">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </button>
            <div className="flex-1">
              <h2 className="font-bold text-lg">{selectedCustomer.full_name}</h2>
              <p className="text-sm text-muted-foreground">{selectedCustomer.phone || 'Chưa có SĐT'} · {selectedCustomer.email || ''}</p>
            </div>
            <button
              onClick={() => handleOpenEditModal(selectedCustomer)}
              className="px-3 py-1.5 border border-input rounded-lg text-xs font-semibold hover:bg-accent"
            >
              Chỉnh sửa
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Tổng chi tiêu</p>
              <p className="font-bold text-primary mt-1">{formatCurrency(selectedCustomer.total_spent)}</p>
            </div>
            <div className="bg-card border rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lịch hẹn</p>
              <p className="font-bold mt-1">{selectedCustomer.total_bookings}</p>
            </div>
            <div className="bg-card border rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ghi chú</p>
              <p className="font-bold mt-1">{customerNotes.length}</p>
            </div>
            <div className="bg-card border rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lượt ghé gần nhất</p>
              <p className="text-xs font-semibold mt-1">{selectedCustomer.last_visit_at ? formatDate(selectedCustomer.last_visit_at) : 'Chưa có'}</p>
            </div>
          </div>

          {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedCustomer.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-0.5 bg-accent text-accent-foreground rounded-full text-[11px] font-semibold">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Notes section */}
          <div className="bg-card border rounded-xl p-4 sm:p-5">
            <h3 className="font-semibold text-sm mb-3">Ghi chú khách hàng</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Thêm ghi chú..."
                className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-sm"
              />
              <button
                onClick={handleAddNote}
                disabled={submittingNote || !newNote.trim()}
                className="px-3 h-9 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {submittingNote ? '...' : 'Thêm'}
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customerNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có ghi chú nào</p>
              ) : (
                customerNotes.map((n) => (
                  <div key={n.id} className="border-b last:border-0 py-2.5">
                    <p className="text-sm">{n.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.created_by_name} · {formatDate(n.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl">Đang tải...</div>
      ) : customers.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl">Không tìm thấy khách hàng</div>
      ) : (
        <>
          <div className="sm:hidden space-y-2">
            {customers.map((c) => (
              <button key={c.id} onClick={() => handleSelectCustomer(c)} className="w-full text-left bg-card border rounded-xl p-3.5 hover:bg-accent/50 active:bg-accent/80 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.phone || 'Chưa có SĐT'}</p>
                  </div>
                  <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </div>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{c.total_bookings} đặt lịch</span>
                  <span>{formatCurrency(c.total_spent)} đã chi</span>
                </div>
              </button>
            ))}
          </div>
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tên</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">SĐT</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Đặt lịch</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Tổng chi</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer active:bg-accent/80" onClick={() => handleSelectCustomer(c)}>
                      <td className="px-4 py-3 font-medium">{c.full_name}</td>
                      <td className="px-4 py-3">{c.phone || '-'}</td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">{c.total_bookings}</td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell font-semibold">{formatCurrency(c.total_spent)}</td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">{c.last_visit_at ? formatDate(c.last_visit_at) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && <Pagination pagination={pagination} onPrev={() => fetchCustomers(pagination.page - 1, search)} onNext={() => fetchCustomers(pagination.page + 1, search)} />}
          </div>
        </>
      )}

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]">
          <div className="bg-background border rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">{editCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-accent text-muted-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Họ tên *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Số điện thoại</label>
                  <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Email</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Giới tính</label>
                <select value={formGender} onChange={(e) => setFormGender(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                  <option value="">Không rõ</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-accent">Hủy</button>
              <button onClick={handleSaveCustomer} disabled={submitting} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? 'Đang lưu...' : 'Hoàn tất'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
