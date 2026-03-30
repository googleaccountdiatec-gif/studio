/**
 * Client-side CSV export utility.
 * Generates a CSV string from data and triggers a browser download.
 */

function escapeCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; header: string }[],
  filename: string
): void {
  if (data.length === 0) return

  const headerRow = columns.map(c => escapeCell(c.header)).join(',')
  const dataRows = data.map(row =>
    columns.map(c => escapeCell(row[c.key])).join(',')
  )
  const csvContent = [headerRow, ...dataRows].join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
