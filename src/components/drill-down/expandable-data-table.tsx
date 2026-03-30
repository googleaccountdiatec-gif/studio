"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ExpandableColumn<T> {
  key: string
  header: string
  cell?: (row: T) => React.ReactNode
  sortable?: boolean
}

interface ExpandableDataTableProps<T> {
  columns: ExpandableColumn<T>[]
  data: T[]
  getRowId: (row: T) => string
  expandedContent?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  getRowClassName?: (row: T) => string
  pageSize?: number
}

export function ExpandableDataTable<T extends Record<string, any>>({
  columns,
  data,
  getRowId,
  expandedContent,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  getRowClassName,
  pageSize = 10,
}: ExpandableDataTableProps<T>) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [page, setPage] = React.useState(0)

  React.useEffect(() => setPage(0), [data])

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? ''
      const bVal = b[sortKey] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const pagedData = sortedData.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(data.length / pageSize)

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelect = (id: string) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {expandedContent && <TableHead className="w-8" />}
              {selectable && <TableHead className="w-8" />}
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={col.sortable ? "cursor-pointer select-none" : ""}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (expandedContent ? 1 : 0) + (selectable ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  No data
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map(row => {
                const id = getRowId(row)
                const isExpanded = expandedRows.has(id)
                return (
                  <React.Fragment key={id}>
                    <TableRow
                      className={cn(
                        onRowClick && "cursor-pointer hover:bg-muted/50",
                        getRowClassName?.(row)
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {expandedContent && (
                        <TableCell className="w-8 p-2">
                          <button onClick={e => toggleExpand(id, e)} className="p-1 rounded hover:bg-muted">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4" />
                              : <ChevronRight className="w-4 h-4" />
                            }
                          </button>
                        </TableCell>
                      )}
                      {selectable && (
                        <TableCell className="w-8 p-2" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds?.has(id)}
                            onCheckedChange={() => toggleSelect(id)}
                          />
                        </TableCell>
                      )}
                      {columns.map(col => (
                        <TableCell key={col.key}>
                          {col.cell ? col.cell(row) : String(row[col.key] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandedContent && isExpanded && (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length + 1 + (selectable ? 1 : 0)}
                          className="bg-muted/30 p-4"
                        >
                          {expandedContent(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-muted-foreground">
            {data.length} items — Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
