export function Pagination({ pagination, onPrev, onNext }: { pagination: { total: number; page: number; totalPages: number }; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <span className="text-xs sm:text-sm text-muted-foreground">{pagination.total} kết quả · Trang {pagination.page}/{pagination.totalPages}</span>
      <div className="flex gap-2">
        <button disabled={pagination.page <= 1} onClick={onPrev} className="px-3 py-1.5 text-xs sm:text-sm border rounded-md hover:bg-accent disabled:opacity-50 active:scale-95 transition-all">Trước</button>
        <button disabled={pagination.page >= pagination.totalPages} onClick={onNext} className="px-3 py-1.5 text-xs sm:text-sm border rounded-md hover:bg-accent disabled:opacity-50 active:scale-95 transition-all">Sau</button>
      </div>
    </div>
  )
}
