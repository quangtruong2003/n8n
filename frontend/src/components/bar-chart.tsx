export function BarChart({ data }: { data: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-px sm:gap-[2px] h-full w-full">
      {data.map((d) => (
        <div key={d.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div
            className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-colors min-h-[2px]"
            style={{ height: `${(d.count / maxCount) * 100}%` }}
          />
          <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-1 select-none">{d.hour}h</span>
          {d.count > 0 && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-sm">
              {d.count} tin
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
