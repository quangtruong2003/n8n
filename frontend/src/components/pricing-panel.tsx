'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/header'

interface Product {
  id: string
  name: string
  type: 'service' | 'product' | 'combo'
  price: number
  duration_minutes: number | null
  description: string | null
  stock_quantity: number | null
  active: number
  category_name: string | null
}

export function PricingPanel() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('service')
  const [formPrice, setFormPrice] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStock, setFormStock] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (typeFilter) params.set('type', typeFilter)
      if (search) params.set('search', search)
      const res = await api.get(`/api/products?${params}`)
      setProducts(res.data || [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải danh sách')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, search])

  useEffect(() => {
    const t = setTimeout(() => fetchProducts(), 300)
    return () => clearTimeout(t)
  }, [fetchProducts])

  const handleOpenCreate = () => {
    setEditProduct(null)
    setFormName('')
    setFormType('service')
    setFormPrice('')
    setFormDuration('')
    setFormDescription('')
    setFormStock('')
    setShowModal(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditProduct(p)
    setFormName(p.name)
    setFormType(p.type)
    setFormPrice(String(p.price))
    setFormDuration(p.duration_minutes ? String(p.duration_minutes) : '')
    setFormDescription(p.description || '')
    setFormStock(p.stock_quantity != null ? String(p.stock_quantity) : '')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formPrice) {
      toast.error('Tên và giá là bắt buộc')
      return
    }
    setSubmitting(true)
    try {
      const body: any = {
        name: formName.trim(),
        type: formType,
        price: Number(formPrice),
      }
      if (formDuration) body.duration_minutes = Number(formDuration)
      if (formDescription) body.description = formDescription.trim()
      if (formStock && formType === 'product') body.stock_quantity = Number(formStock)

      if (editProduct) {
        await api.put(`/api/products/${editProduct.id}`, body)
        toast.success('Cập nhật thành công')
      } else {
        await api.post('/api/products', body)
        toast.success('Tạo mới thành công')
      }
      setShowModal(false)
      fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu dữ liệu')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (p: Product) => {
    try {
      await api.put(`/api/products/${p.id}`, { active: p.active ? 0 : 1 })
      toast.success(p.active ? 'Đã ẩn sản phẩm' : 'Đã hiện sản phẩm')
      fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật')
    }
  }

  const getTypeLabel = (t: string) => {
    switch (t) {
      case 'service': return 'Dịch vụ'
      case 'product': return 'Sản phẩm'
      case 'combo': return 'Combo'
      default: return t
    }
  }

  const getTypeBadge = (t: string) => {
    switch (t) {
      case 'service': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'product': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'combo': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Header title="Dịch vụ & Sản phẩm" />
        <button onClick={handleOpenCreate} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all self-start sm:self-auto">
          + Thêm mới
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input type="text" placeholder="Tìm kiếm..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm">
          <option value="">Tất cả loại</option>
          <option value="service">Dịch vụ</option>
          <option value="product">Sản phẩm</option>
          <option value="combo">Combo</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-7 w-14 rounded-md" />
                <Skeleton className="h-7 w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl">Không có sản phẩm/dịch vụ nào</div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {products.map((p) => (
              <div key={p.id} className={`bg-card border rounded-xl p-3.5 space-y-1.5 ${!p.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-primary font-semibold text-sm">{formatCurrency(p.price)}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${getTypeBadge(p.type)}`}>
                    {getTypeLabel(p.type)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEdit(p)} className="px-3 py-1 text-xs border rounded-md hover:bg-accent">Sửa</button>
                  <button onClick={() => handleToggleActive(p)} className="px-3 py-1 text-xs border rounded-md hover:bg-accent">
                    {p.active ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tên</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Loại</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Giá</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Thời lượng</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Tồn kho</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className={`border-b last:border-0 hover:bg-accent/50 ${!p.active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        {p.category_name && <div className="text-[11px] text-muted-foreground">{p.category_name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getTypeBadge(p.type)}`}>
                          {getTypeLabel(p.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.price)}</td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">{p.duration_minutes ? `${p.duration_minutes} phút` : '-'}</td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {p.type === 'product' ? (
                          <span className={`text-xs font-semibold ${p.stock_quantity != null && p.stock_quantity < 5 ? 'text-red-500' : ''}`}>
                            {p.stock_quantity != null ? p.stock_quantity : '-'}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                          {p.active ? 'Hiện' : 'Ẩn'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleOpenEdit(p)} className="px-3 py-1 text-xs border rounded-md hover:bg-accent">Sửa</button>
                          <button onClick={() => handleToggleActive(p)} className="px-3 py-1 text-xs border rounded-md hover:bg-accent">
                            {p.active ? 'Ẩn' : 'Hiện'}
                          </button>
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

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]">
          <div className="bg-background border rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">{editProduct ? 'Sửa dịch vụ / sản phẩm' : 'Thêm dịch vụ / sản phẩm mới'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-accent text-muted-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tên *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Loại *</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                    <option value="service">Dịch vụ</option>
                    <option value="product">Sản phẩm (tồn kho)</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Giá (VNĐ) *</label>
                  <input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Thời lượng (phút)</label>
                  <input type="number" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" placeholder="VD: 60" />
                </div>
                {formType === 'product' && (
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tồn kho</label>
                    <input type="number" value={formStock} onChange={(e) => setFormStock(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Mô tả</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-accent">Hủy</button>
              <button onClick={handleSave} disabled={submitting} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? 'Đang lưu...' : 'Hoàn tất'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
