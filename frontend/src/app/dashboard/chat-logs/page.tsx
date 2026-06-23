'use client'

import { ChatLogsPanel } from '@/components/chat-logs-panel'
import { useAuth } from '@/hooks/use-auth'

export default function ChatLogsPage() {
  const { spaId } = useAuth()
  return <ChatLogsPanel spaId={spaId} />
}
