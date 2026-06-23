'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { SpaInfo } from '@/lib/types'
import { Header } from '@/components/header'

export function SettingsPanel({ spa, onUpdate }: { spa: SpaInfo; onUpdate: (s: SpaInfo) => void }) {
  const [form, setForm] = useState({
    name: spa.name,
    phone: spa.phone || '',
    openTime: spa.openTime || '08:00',
    closeTime: spa.closeTime || '22:00',
    botActive: spa.botActive,
    botGreeting: spa.config?.botGreeting || '',
    botName: spa.config?.botName || 'CS Bot',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/api/spa/${spa.id}/config`, form)
      const meData = await api.get('/api/auth/me')
      onUpdate(meData.spa)
      toast.success('Lưu cài đặt thành công')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu cài đặt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Cài đặt" />

      <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-6">
        <div>
          <h3 className="font-semibold mb-4 text-sm">Thông tin Spa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Tên Spa</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">SĐT chủ</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Giờ mở cửa</label>
              <input type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Giờ đóng cửa</label>
              <input type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4 text-sm">Cấu hình Bot</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">Bật/Tắt Bot</p>
                <p className="text-xs text-muted-foreground">Khi tắt, bot sẽ ngừng phản hồi</p>
              </div>
              <button
                onClick={() => setForm({ ...form, botActive: !form.botActive })}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 active:scale-95 transition-all ${
                  form.botActive ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={form.botActive}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${form.botActive ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Tên Bot</label>
              <input value={form.botName} onChange={(e) => setForm({ ...form, botName: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Lời chào Bot</label>
              <textarea value={form.botGreeting} onChange={(e) => setForm({ ...form, botGreeting: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none" />
            </div>
          </div>
        </div>

        {spa.branches.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4 text-sm">Chi nhánh</h3>
            <div className="space-y-2">
              {spa.branches.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{b.name}</p>
                    {b.address && <p className="text-xs text-muted-foreground truncate">{b.address}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 active:scale-[0.97] transition-all">
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  )
}
