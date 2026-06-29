'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

interface BotConfig {
  bot_name: string
  bot_greeting: string
  ai_enabled: boolean
  ai_system_prompt: string
  working_hours_only: boolean
  web_widget_enabled: boolean
  web_widget_theme: {
    primaryColor: string
    position: 'bottom-right' | 'bottom-left'
    greeting?: string
  }
}

interface TenantData {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  logo_url: string | null
  open_time: string
  close_time: string
}

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'tenant' | 'bot' | 'zalo' | 'widget'>('tenant')

  // Tenant state
  const [tenant, setTenant] = useState<TenantData | null>(null)
  const [savingTenant, setSavingTenant] = useState(false)

  // Bot Config state
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null)
  const [savingBot, setSavingBot] = useState(false)

  // Zalo state
  const [zaloStatus, setZaloStatus] = useState<{ connected: boolean; accountName?: string }>({ connected: false })
  const [loadingZalo, setLoadingZalo] = useState(true)
  const [zaloCookies, setZaloCookies] = useState('')
  const [zaloImei, setZaloImei] = useState('')
  const [zaloUserAgent, setZaloUserAgent] = useState('')
  const [connectingZalo, setConnectingZalo] = useState(false)

  useEffect(() => {
    // Load Tenant Settings
    api.get('/api/tenant/settings')
      .then((res) => setTenant(res.data))
      .catch(() => toast.error('Lỗi tải cài đặt doanh nghiệp'))

    // Load Bot Config
    api.get('/api/bot/config')
      .then((res) => {
        if (res.data) {
          const theme = typeof res.data.web_widget_theme === 'string'
            ? JSON.parse(res.data.web_widget_theme)
            : res.data.web_widget_theme || { primaryColor: '#4F46E5', position: 'bottom-right' }
          setBotConfig({
            bot_name: res.data.bot_name || 'AI Assistant',
            bot_greeting: res.data.bot_greeting || '',
            ai_enabled: res.data.ai_enabled === 1,
            ai_system_prompt: res.data.ai_system_prompt || '',
            working_hours_only: res.data.working_hours_only === 1,
            web_widget_enabled: res.data.web_widget_enabled === 1,
            web_widget_theme: theme
          })
        }
      })
      .catch(() => toast.error('Lỗi tải cấu hình bot'))

    // Load Zalo Status
    api.get('/api/bot/zalo')
      .then((res) => setZaloStatus(res.data || { connected: false }))
      .catch(() => {})
      .finally(() => setLoadingZalo(false))
  }, [])

  const handleSaveTenant = async () => {
    if (!tenant) return
    setSavingTenant(true)
    try {
      await api.put('/api/tenant/settings', tenant)
      toast.success('Lưu thông tin doanh nghiệp thành công')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu thông tin')
    } finally {
      setSavingTenant(false)
    }
  }

  const handleSaveBot = async () => {
    if (!botConfig) return
    setSavingBot(true)
    try {
      await api.put('/api/bot/config', {
        bot_name: botConfig.bot_name,
        bot_greeting: botConfig.bot_greeting,
        ai_enabled: botConfig.ai_enabled ? 1 : 0,
        ai_system_prompt: botConfig.ai_system_prompt,
        working_hours_only: botConfig.working_hours_only ? 1 : 0,
        web_widget_enabled: botConfig.web_widget_enabled ? 1 : 0,
        web_widget_theme: JSON.stringify(botConfig.web_widget_theme)
      })
      toast.success('Lưu cấu hình bot thành công')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu cấu hình')
    } finally {
      setSavingBot(false)
    }
  }

  const handleConnectZalo = async () => {
    if (!zaloCookies.trim()) {
      toast.error('Vui lòng nhập cookies Zalo')
      return
    }
    setConnectingZalo(true)
    try {
      // Cookies formatted as object
      const cookiesObj = JSON.parse(zaloCookies)
      const res = await api.post('/api/bot/zalo', {
        action: 'connect',
        cookies: cookiesObj,
        imei: zaloImei || null,
        user_agent: zaloUserAgent || null
      })
      if (res.success) {
        toast.success('Đang thực hiện kết nối Zalo...')
        setZaloStatus({ connected: true, accountName: res.data?.accountName || 'Đang kết nối' })
        setZaloCookies('')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi kết nối Zalo (Check định dạng JSON Cookies)')
    } finally {
      setConnectingZalo(false)
    }
  }

  const handleDisconnectZalo = async () => {
    try {
      const res = await api.post('/api/bot/zalo', { action: 'disconnect' })
      if (res.success) {
        toast.success('Đã ngắt kết nối Zalo')
        setZaloStatus({ connected: false })
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi ngắt kết nối')
    }
  }

  const tabs = [
    { id: 'tenant', label: 'Doanh nghiệp' },
    { id: 'bot', label: 'Cấu hình Bot' },
    { id: 'zalo', label: 'Cài đặt Zalo' },
    { id: 'widget', label: 'Giao diện Widget' }
  ] as const

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="shrink-0">
        <h2 className="text-xl sm:text-2xl font-bold">Cài đặt hệ thống</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Sidebar Tabs */}
        <aside className="lg:w-[200px] shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm rounded-md whitespace-nowrap text-left transition-all ${
                activeTab === t.id
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </aside>

      {/* Content Panels */}
      <div className="bg-card border rounded-xl p-4 sm:p-5 shadow-sm space-y-6">
        {/* Skeleton for initial load */}
        {tenant === null && botConfig === null && (
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: TENANT SETTINGS */}
        {activeTab === 'tenant' && tenant && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm border-b pb-2 uppercase text-muted-foreground">Thông tin cơ sở</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tên Doanh Nghiệp</label>
                <input
                  value={tenant.name}
                  onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Hotline liên hệ</label>
                <input
                  value={tenant.phone || ''}
                  onChange={(e) => setTenant({ ...tenant, phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Giờ mở cửa</label>
                <input
                  type="time"
                  value={tenant.open_time}
                  onChange={(e) => setTenant({ ...tenant, open_time: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Giờ đóng cửa</label>
                <input
                  type="time"
                  value={tenant.close_time}
                  onChange={(e) => setTenant({ ...tenant, close_time: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Địa chỉ chính</label>
                <input
                  value={tenant.address || ''}
                  onChange={(e) => setTenant({ ...tenant, address: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSaveTenant}
                disabled={savingTenant}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {savingTenant ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: BOT CONFIGURATION */}
        {activeTab === 'bot' && botConfig && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm border-b pb-2 uppercase text-muted-foreground">Tham số trợ lý ảo</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-3 bg-muted/40 rounded-lg">
                <div>
                  <p className="font-semibold text-sm">Bật phản hồi tự động</p>
                  <p className="text-xs text-muted-foreground">Kích hoạt AI chatbot trả lời khách hàng</p>
                </div>
                <button
                  onClick={() => setBotConfig({ ...botConfig, ai_enabled: !botConfig.ai_enabled })}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 active:scale-95 ${
                    botConfig.ai_enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${botConfig.ai_enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 bg-muted/40 rounded-lg">
                <div>
                  <p className="font-semibold text-sm">Chỉ hoạt động trong giờ làm việc</p>
                  <p className="text-xs text-muted-foreground">Nếu bật, bot sẽ không trả lời ngoài khung giờ hoạt động</p>
                </div>
                <button
                  onClick={() => setBotConfig({ ...botConfig, working_hours_only: !botConfig.working_hours_only })}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 active:scale-95 ${
                    botConfig.working_hours_only ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${botConfig.working_hours_only ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tên Trợ Lý Ảo</label>
                  <input
                    value={botConfig.bot_name}
                    onChange={(e) => setBotConfig({ ...botConfig, bot_name: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Lời chào mở màn</label>
                  <textarea
                    value={botConfig.bot_greeting}
                    onChange={(e) => setBotConfig({ ...botConfig, bot_greeting: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Kịch bản AI (System Prompt)</label>
                  <textarea
                    value={botConfig.ai_system_prompt}
                    onChange={(e) => setBotConfig({ ...botConfig, ai_system_prompt: e.target.value })}
                    rows={6}
                    placeholder="Vai trò, tính cách bot, hướng dẫn chỉ trả lời dịch vụ..."
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSaveBot}
                disabled={savingBot}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {savingBot ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ZALO INTEGRATION */}
        {activeTab === 'zalo' && (
          <div className="space-y-5">
            <h3 className="font-semibold text-sm border-b pb-2 uppercase text-muted-foreground">Liên kết Zalo Bot</h3>

            {/* Status Panel */}
            <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/20">
              <div>
                <p className="font-bold text-sm">Trạng thái Zalo</p>
                {loadingZalo ? (
                  <Skeleton className="h-3 w-32 mt-1" />
                ) : zaloStatus.connected ? (
                  <p className="text-xs text-green-600 font-semibold flex items-center gap-1.5 mt-0.5">
                    ● Đã kết nối Zalo: <span className="font-bold underline">{zaloStatus.accountName || 'Tài khoản'}</span>
                  </p>
                ) : (
                  <p className="text-xs text-red-500 font-semibold flex items-center gap-1.5 mt-0.5">
                    ● Chưa kết nối (Offline)
                  </p>
                )}
              </div>
              {zaloStatus.connected && (
                <button
                  onClick={handleDisconnectZalo}
                  className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-[0.97] rounded-lg text-xs font-semibold"
                >
                  Ngắt kết nối Zalo
                </button>
              )}
            </div>

            {/* Connection Inputs */}
            {!zaloStatus.connected && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Zalo Cookies (JSON format)</label>
                  <textarea
                    value={zaloCookies}
                    onChange={(e) => setZaloCookies(e.target.value)}
                    rows={4}
                    placeholder='{"cookie":"value", ...}'
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background font-mono text-xs resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Zalo IMEI (Optional)</label>
                    <input
                      value={zaloImei}
                      onChange={(e) => setZaloImei(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">User Agent (Optional)</label>
                    <input
                      value={zaloUserAgent}
                      onChange={(e) => setZaloUserAgent(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleConnectZalo}
                    disabled={connectingZalo}
                    className="w-full sm:w-auto px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    {connectingZalo ? 'Đang kết nối...' : 'Kích hoạt Zalo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WIDGET THEME CUSTOMIZATION */}
        {activeTab === 'widget' && botConfig && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm border-b pb-2 uppercase text-muted-foreground">Tùy biến Chat Web Widget</h3>

            <div className="flex items-center justify-between gap-4 p-3 bg-muted/40 rounded-lg">
              <div>
                <p className="font-semibold text-sm">Hiển thị Widget trên trang</p>
                <p className="text-xs text-muted-foreground">Bật/tắt nút bong bóng chat nổi bên ngoài trang web khách</p>
              </div>
              <button
                onClick={() => setBotConfig({ ...botConfig, web_widget_enabled: !botConfig.web_widget_enabled })}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 active:scale-95 ${
                  botConfig.web_widget_enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${botConfig.web_widget_enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {botConfig.web_widget_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Màu chủ đạo (Primary Color)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={botConfig.web_widget_theme.primaryColor}
                      onChange={(e) => setBotConfig({
                        ...botConfig,
                        web_widget_theme: { ...botConfig.web_widget_theme, primaryColor: e.target.value }
                      })}
                      className="w-12 h-10 border rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={botConfig.web_widget_theme.primaryColor}
                      onChange={(e) => setBotConfig({
                        ...botConfig,
                        web_widget_theme: { ...botConfig.web_widget_theme, primaryColor: e.target.value }
                      })}
                      className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Vị trí hiển thị</label>
                  <select
                    value={botConfig.web_widget_theme.position}
                    onChange={(e) => setBotConfig({
                      ...botConfig,
                      web_widget_theme: { ...botConfig.web_widget_theme, position: e.target.value as any }
                    })}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  >
                    <option value="bottom-right">Góc phải dưới (Bottom Right)</option>
                    <option value="bottom-left">Góc trái dưới (Bottom Left)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Lời chào ngoài bong bóng (Widget Greeting)</label>
                  <input
                    value={botConfig.web_widget_theme.greeting || ''}
                    onChange={(e) => setBotConfig({
                      ...botConfig,
                      web_widget_theme: { ...botConfig.web_widget_theme, greeting: e.target.value }
                    })}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                    placeholder="Chat với chúng tôi..."
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSaveBot}
                disabled={savingBot}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {savingBot ? 'Đang lưu giao diện...' : 'Lưu cấu hình Widget'}
              </button>
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  )
}
