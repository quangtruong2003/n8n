'use client'

import { PricingPanel } from '@/components/pricing-panel'
import { useAuth } from '@/hooks/use-auth'

export default function PricingPage() {
  const { spaId } = useAuth()
  return <PricingPanel spaId={spaId} />
}
