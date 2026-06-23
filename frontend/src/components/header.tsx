export function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
