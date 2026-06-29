'use client'

import { useEffect, useState } from 'react'

export function StatCard({ title, value, subtitle, icon, change }: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  change?: { value: string; type: 'up' | 'down' | 'neutral' }
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-mono)]">{value}</p>
      {(change || subtitle) && (
        <div className="flex items-center gap-2 mt-2">
          {change && (
            <span className={`text-xs font-medium ${
              change.type === 'up' ? 'text-success' : change.type === 'down' ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {change.type === 'up' ? '↑' : change.type === 'down' ? '↓' : ''} {change.value}
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}
