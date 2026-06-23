export function StatCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl p-4 sm:p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">{icon}</div>
      </div>
    </div>
  )
}
