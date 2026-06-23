export const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN').format(price) + 'đ'
export const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN')
export const formatDateTime = (d: string | Date) => new Date(d).toLocaleString('vi-VN')

export const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  completed: { label: 'Hoàn thành', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
}
