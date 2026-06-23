'use client'

import { SettingsPanel } from '@/components/settings-panel'
import { useAuth } from '@/hooks/use-auth'

export default function SettingsPage() {
  const { spa, updateSpa } = useAuth()
  return <SettingsPanel spa={spa} onUpdate={updateSpa} />
}
