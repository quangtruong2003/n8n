'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import type { Service, ServiceFormData } from '@/lib/types'
import { Header } from '@/components/header'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

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

export function PricingPanel({ spaId }: { spaId: string }) {
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
