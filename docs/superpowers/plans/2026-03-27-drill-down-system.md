# Interactive Drill-Down System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform every chart and KPI card across all 7 dashboards into clickable entry points that open rich, multi-level drill-down panels with sub-charts, inline filtering, comparison, export, and cross-domain linking.

**Architecture:** Shared drill-down framework (DrillDownSheet, SummaryBar, FilterBar, ExpandableDataTable, DetailSection, etc.) with pluggable, domain-specific insight panels per dashboard. Multi-level navigation uses iOS-style nested panels with breadcrumb trail. All state is local to the drill-down owner — no changes to DataContext.

**Tech Stack:** Next.js 15, React 18, Recharts 2.15, shadcn/ui (Radix primitives), Tailwind CSS, date-fns 3, TypeScript 5. No test framework — verification via `npm run typecheck` and `npm run build`.

**Spec:** `docs/2026-03-27-drill-down-system-design.md`
**Data changes:** `docs/newdata.md`

---

## Phase 1: Data Foundation

Update all type definitions and interfaces to accommodate the 31 new fields + 1 rename from updated eQMS exports. This must happen first because every subsequent task depends on these types.

---

### Task 1: Update shared types (CapaData + DocumentKpiData)

**Files:**
- Modify: `src/lib/types.ts:1-42`

- [ ] **Step 1: Update CapaData interface**

Open `src/lib/types.ts`. Replace the `CapaData` interface (lines 1-11) with:

```ts
export interface CapaData {
  'CAPA ID': string;
  'Title': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
  'Completed On'?: string;
  'Category of Corrective Action'?: string;
  'Priority'?: string;
  'Action taken'?: string;
  'Expected results of Action'?: string;
  'Action plan'?: string;
  'Description'?: string;
  'Proposed responsible'?: string;
  isOverdue?: boolean;
  effectiveDueDate?: Date;
}
```

- [ ] **Step 2: Update DocumentKpiData interface**

Replace the `DocumentKpiData` interface (lines 13-22) with:

```ts
export interface DocumentKpiData {
  'Doc Prefix': string;
  'Doc Number': string;
  'Title': string;
  'Version Date': string;
  'Document Flow': string;
  'Pending Steps': string;
  'Completed On': string;
  'Author': string;
  'Version'?: string;
  'Change Reason'?: string;
  'Responsible'?: string;
  'Authorized copy'?: string;
  'Periodic review of document'?: string;
  'Distribution List'?: string;
}
```

- [ ] **Step 3: Verify types compile**

Run: `npm run typecheck`
Expected: May show pre-existing errors, but no new errors from our type changes. The `DocumentKpiData` rename from `'Responsible'` to `'Author'` will cause errors in `documents-in-flow-dashboard.tsx` — that's expected and will be fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add new CAPA and Document KPI fields to shared types"
```

---

### Task 2: Update Batch Release interface with dedup logic

**Files:**
- Modify: `src/components/batch-release-dashboard.tsx:1-57`

- [ ] **Step 1: Add typed interface at top of file**

In `batch-release-dashboard.tsx`, add this interface after the imports (before the component function, around line 45):

```ts
interface BatchReleaseData {
  'Batch number': string;
  'Batch number from list'?: string;
  'Project Number'?: string;
  'Product number'?: string;
  'Product Name'?: string;
  'Final batch status': string;
  'Clone name': string;
  'High-risk nonconformance': string;
  'Low-risk nonconformances': string;
  'Type of Production': string;
  'Company': string;
  'Company aliases': string;
  'Completed On': string;
  canonicalBatchNumber?: string;
  [key: string]: any;
}
```

- [ ] **Step 2: Add canonical batch number computation**

In the `processedData` useMemo (line ~59), after the existing filter for "Approved" batches, add the canonical batch number computation. Find the `.filter(...)` chain and add a `.map(...)` after it:

```ts
.map((item: any) => ({
  ...item,
  canonicalBatchNumber: (item['Batch number from list'] && item['Batch number from list'].trim() !== '')
    ? item['Batch number from list']
    : item['Batch number'],
}))
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck`
Expected: No new errors from these changes.

- [ ] **Step 4: Commit**

```bash
git add src/components/batch-release-dashboard.tsx
git commit -m "feat: add batch release interface with canonical batch number dedup"
```

---

### Task 3: Update Change Action interface

**Files:**
- Modify: `src/components/change-action-dashboard.tsx:1-66`

- [ ] **Step 1: Add typed interface**

In `change-action-dashboard.tsx`, add this interface after imports (before the component function):

```ts
interface ChangeActionData {
  'Change_ActionID': string;
  'Action required prior to change': string;
  'Responsible': string;
  'Pending Steps': string;
  'Deadline': string;
  'Change Title': string;
  'Change ID (CMID)': string;
  'Approve'?: string;
  'Registration Time': string;
  'Completed On'?: string;
  isOverdue: boolean;
  deadlineDate: Date;
  registrationDate: Date;
  [key: string]: any;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/change-action-dashboard.tsx
git commit -m "feat: add change action interface with approve and completed fields"
```

---

### Task 4: Update Non-Conformance interface

**Files:**
- Modify: `src/components/non-conformance-dashboard.tsx:1-69`

- [ ] **Step 1: Add typed interface**

In `non-conformance-dashboard.tsx`, add this interface after imports (before the component function):

```ts
interface NonConformanceData {
  'Id': string;
  'Non Conformance Title': string;
  'Classification': string;
  'Pending Steps': string;
  'Case Worker': string;
  'Status': string;
  'Registration Time': string;
  'Registered By': string;
  'Reoccurrence': string;
  'Completed On'?: string;
  'Impact Other'?: string;
  'Investigation summary'?: string;
  'Impact Assessment'?: string;
  'Root cause description'?: string;
  'Classification justification'?: string;
  'Segregation of product'?: string;
  'Discarded product'?: string;
  'Started new production'?: string;
  'Repeated operation/analysis'?: string;
  registrationDate: Date;
  [key: string]: any;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/non-conformance-dashboard.tsx
git commit -m "feat: add non-conformance interface with investigation and corrective action fields"
```

---

### Task 5: Update Training interface

**Files:**
- Modify: `src/components/training-dashboard.tsx:1-115`

- [ ] **Step 1: Add typed interface**

In `training-dashboard.tsx`, add this interface after imports (before the component function):

```ts
interface TrainingData {
  'Record training ID': string;
  'Title': string;
  'Trainee': string;
  'Training category': string;
  'Deadline for completing training': string;
  'Final training approval'?: string;
  'Pending Steps': string;
  'Completed On'?: string;
  [key: string]: any;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/training-dashboard.tsx
git commit -m "feat: add training interface with approval and completion fields"
```

---

### Task 6: Rename Responsible → Author in Documents in Flow

**Files:**
- Modify: `src/components/documents-in-flow-dashboard.tsx`

- [ ] **Step 1: Find and replace all references**

In `documents-in-flow-dashboard.tsx`, search for all occurrences of `'Responsible'` as a property accessor and replace with `'Author'`. The file is 120 lines — read it fully, find every reference to `Responsible` in data access patterns (e.g., `item['Responsible']`, column definitions referencing `'Responsible'`), and replace with `'Author'`.

Note: The `DocumentKpiData` type in `types.ts` was already updated in Task 1. This task fixes the component that consumes it.

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors related to `Responsible` on `DocumentKpiData`.

- [ ] **Step 3: Commit**

```bash
git add src/components/documents-in-flow-dashboard.tsx
git commit -m "fix: rename Responsible to Author in documents dashboard to match eQMS export"
```

---

## Phase 2: Shared Drill-Down Framework

Build the reusable component library that all dashboards will use. Each component is self-contained and can be built independently.

---

### Task 7: CSV export utility

**Files:**
- Create: `src/lib/csv-export.ts`

- [ ] **Step 1: Create the export utility**

Create `src/lib/csv-export.ts`:

```ts
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
```

The `\uFEFF` BOM prefix ensures Excel opens the file with correct encoding for Norwegian characters (ø, å, etc.).

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/csv-export.ts
git commit -m "feat: add client-side CSV export utility with UTF-8 BOM for Excel"
```

---

### Task 8: Cross-reference parser

**Files:**
- Create: `src/lib/cross-references.ts`

- [ ] **Step 1: Create the parser**

Create `src/lib/cross-references.ts`:

```ts
export interface CrossReference {
  domain: 'capa' | 'change-action'
  id: string
  rawMatch: string
}

/**
 * Parses Change Reason text from Document KPI records to find
 * references to CAPAs and Change Actions (CMIDs).
 *
 * Examples of matched patterns:
 *   "CAPA281: Added field for signature" → { domain: 'capa', id: '281' }
 *   "CMID15: Change of company name"     → { domain: 'change-action', id: '15' }
 *   "Change Action 578: Update Doc"      → { domain: 'change-action', id: '578' }
 *   "according to CAPA 073"              → { domain: 'capa', id: '73' }
 *   "CA600.Used text..."                 → { domain: 'change-action', id: '600' }
 */
export function parseCrossReferences(changeReason: string | undefined | null): CrossReference[] {
  if (!changeReason) return []

  const refs: CrossReference[] = []
  const seen = new Set<string>()

  const patterns: { regex: RegExp; domain: CrossReference['domain'] }[] = [
    { regex: /CAPA\s*0*(\d+)/gi, domain: 'capa' },
    { regex: /CMID\s*0*(\d+)/gi, domain: 'change-action' },
    { regex: /(?:Change Action|CA)\s*0*(\d+)/gi, domain: 'change-action' },
  ]

  for (const { regex, domain } of patterns) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(changeReason)) !== null) {
      const id = match[1]
      const key = `${domain}-${id}`
      if (!seen.has(key)) {
        seen.add(key)
        refs.push({ domain, id, rawMatch: match[0] })
      }
    }
  }

  return refs
}

/**
 * Finds all documents whose Change Reason references a given CAPA ID.
 */
export function findLinkedDocuments(
  documents: { 'Change Reason'?: string; [key: string]: any }[],
  domain: 'capa' | 'change-action',
  id: string
): typeof documents {
  return documents.filter(doc => {
    const refs = parseCrossReferences(doc['Change Reason'])
    return refs.some(ref => ref.domain === domain && ref.id === id)
  })
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cross-references.ts
git commit -m "feat: add cross-reference parser for CAPA/CMID links in document Change Reason"
```

---

### Task 9: DrillDownSheet component

**Files:**
- Create: `src/components/drill-down/drill-down-sheet.tsx`

- [ ] **Step 1: Create directory**

Run: `mkdir -p src/components/drill-down`

- [ ] **Step 2: Create DrillDownSheet**

Create `src/components/drill-down/drill-down-sheet.tsx`:

```tsx
"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ChevronLeft, ChevronRight, Download, GitCompare } from "lucide-react"

export interface Breadcrumb {
  label: string
  onClick: () => void
}

interface DrillDownSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  breadcrumbs?: Breadcrumb[]
  onExportCsv?: () => void
  onCompare?: () => void
  compareActive?: boolean
  children: React.ReactNode
}

export function DrillDownSheet({
  open,
  onOpenChange,
  title,
  breadcrumbs = [],
  onExportCsv,
  onCompare,
  compareActive = false,
  children,
}: DrillDownSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[85vw] md:w-[75vw] lg:w-[60vw] sm:max-w-none p-0 flex flex-col"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-3 flex-shrink-0">
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="w-3 h-3" />}
                    <button
                      onClick={crumb.onClick}
                      className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
                    >
                      {crumb.label}
                    </button>
                  </React.Fragment>
                ))}
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{title}</span>
              </nav>
            )}

            {/* Title bar */}
            <div className="flex items-center justify-between">
              <SheetHeader className="p-0">
                <SheetTitle className="text-xl">{title}</SheetTitle>
              </SheetHeader>

              <div className="flex items-center gap-2">
                {onCompare && (
                  <Button
                    variant={compareActive ? "default" : "outline"}
                    size="sm"
                    onClick={onCompare}
                  >
                    <GitCompare className="w-4 h-4 mr-1" />
                    Compare
                  </Button>
                )}
                {onExportCsv && (
                  <Button variant="outline" size="sm" onClick={onExportCsv}>
                    <Download className="w-4 h-4 mr-1" />
                    Export CSV
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Scrollable content */}
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6 pb-6">
              {children}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/drill-down/drill-down-sheet.tsx
git commit -m "feat: add DrillDownSheet component with breadcrumbs, export, compare"
```

---

### Task 10: SummaryBar component

**Files:**
- Create: `src/components/drill-down/summary-bar.tsx`

- [ ] **Step 1: Create SummaryBar**

Create `src/components/drill-down/summary-bar.tsx`:

```tsx
"use client"

import { type LucideIcon, ArrowUp, ArrowDown, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface SummaryMetric {
  label: string
  value: string | number
  color?: 'default' | 'success' | 'warning' | 'danger'
  icon?: LucideIcon
  trend?: { value: number; label: string }
}

interface SummaryBarProps {
  metrics: SummaryMetric[]
}

const colorMap = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

export function SummaryBar({ metrics }: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center gap-2">
            {metric.icon && (
              <metric.icon className="w-4 h-4 text-muted-foreground" />
            )}
            <p className="text-xs text-muted-foreground font-medium">{metric.label}</p>
          </div>
          <p className={cn("text-2xl font-bold mt-1", colorMap[metric.color ?? 'default'])}>
            {metric.value}
          </p>
          {metric.trend && (
            <div className="flex items-center gap-1 mt-1">
              {metric.trend.value > 0 ? (
                <ArrowUp className="w-3 h-3 text-red-500" />
              ) : metric.trend.value < 0 ? (
                <ArrowDown className="w-3 h-3 text-emerald-500" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">{metric.trend.label}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/summary-bar.tsx
git commit -m "feat: add SummaryBar component for drill-down KPI metrics"
```

---

### Task 11: InsightPanel component

**Files:**
- Create: `src/components/drill-down/insight-panel.tsx`

- [ ] **Step 1: Create InsightPanel**

Create `src/components/drill-down/insight-panel.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"

interface InsightPanelProps {
  children: React.ReactNode
  columns?: 1 | 2
  className?: string
}

export function InsightPanel({ children, columns = 2, className }: InsightPanelProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
        className
      )}
    >
      {children}
    </div>
  )
}

interface InsightCardProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function InsightCard({ title, children, className }: InsightCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">{title}</h4>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/insight-panel.tsx
git commit -m "feat: add InsightPanel and InsightCard for drill-down sub-charts"
```

---

### Task 12: FilterBar component

**Files:**
- Create: `src/components/drill-down/filter-bar.tsx`

- [ ] **Step 1: Create FilterBar**

Create `src/components/drill-down/filter-bar.tsx`:

```tsx
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { X, CalendarIcon } from "lucide-react"

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'multi-select' | 'search' | 'toggle' | 'date-range'
  options?: { label: string; value: string }[]
}

interface FilterBarProps {
  filters: FilterConfig[]
  values: Record<string, any>
  onChange: (key: string, value: any) => void
  onReset: () => void
}

export function FilterBar({ filters, values, onChange, onReset }: FilterBarProps) {
  const hasActiveFilters = filters.some(f => {
    const v = values[f.key]
    if (f.type === 'toggle') return v === true
    if (f.type === 'multi-select') return Array.isArray(v) && v.length > 0
    if (f.type === 'search') return typeof v === 'string' && v.length > 0
    if (f.type === 'select') return v && v !== 'all'
    return false
  })

  return (
    <div className="flex flex-wrap items-end gap-3">
      {filters.map(filter => (
        <div key={filter.key} className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{filter.label}</Label>

          {filter.type === 'select' && filter.options && (
            <Select
              value={values[filter.key] ?? 'all'}
              onValueChange={v => onChange(filter.key, v)}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {filter.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filter.type === 'multi-select' && filter.options && (
            <div className="flex flex-wrap gap-1">
              {filter.options.map(opt => {
                const selected = (values[filter.key] as string[] ?? []).includes(opt.value)
                return (
                  <Badge
                    key={opt.value}
                    variant={selected ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      const current = (values[filter.key] as string[]) ?? []
                      const next = selected
                        ? current.filter(v => v !== opt.value)
                        : [...current, opt.value]
                      onChange(filter.key, next)
                    }}
                  >
                    {opt.label}
                  </Badge>
                )
              })}
            </div>
          )}

          {filter.type === 'search' && (
            <Input
              className="h-8 w-[160px]"
              placeholder={`Search ${filter.label.toLowerCase()}...`}
              value={values[filter.key] ?? ''}
              onChange={e => onChange(filter.key, e.target.value)}
            />
          )}

          {filter.type === 'toggle' && (
            <Switch
              checked={values[filter.key] ?? false}
              onCheckedChange={v => onChange(filter.key, v)}
            />
          )}

          {filter.type === 'date-range' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {values[filter.key]?.from
                    ? `${values[filter.key].from.toLocaleDateString()} - ${values[filter.key].to?.toLocaleDateString() ?? '...'}`
                    : 'Pick date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={values[filter.key]}
                  onSelect={(range: any) => onChange(filter.key, range)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      ))}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="h-8">
          <X className="w-3 h-3 mr-1" />
          Reset
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/filter-bar.tsx
git commit -m "feat: add FilterBar component with select, multi-select, search, toggle"
```

---

### Task 13: ExpandableDataTable component

**Files:**
- Create: `src/components/drill-down/expandable-data-table.tsx`

- [ ] **Step 1: Create ExpandableDataTable**

Create `src/components/drill-down/expandable-data-table.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/expandable-data-table.tsx
git commit -m "feat: add ExpandableDataTable with sorting, pagination, expandable rows, selection"
```

---

### Task 14: DetailSection component

**Files:**
- Create: `src/components/drill-down/detail-section.tsx`

- [ ] **Step 1: Create DetailSection**

Create `src/components/drill-down/detail-section.tsx`:

```tsx
"use client"

import * as React from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface DetailSectionProps {
  title: string
  content: string | undefined | null
  emptyText?: string
  collapsible?: boolean
  defaultOpen?: boolean
}

export function DetailSection({
  title,
  content,
  emptyText = "Not provided",
  collapsible = true,
  defaultOpen = true,
}: DetailSectionProps) {
  const isEmpty = !content || content.trim() === '' || content.trim().toLowerCase() === 'na'
  const [open, setOpen] = React.useState(isEmpty ? false : defaultOpen)

  if (collapsible) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border p-3 hover:bg-muted/50 transition-colors">
          <h4 className="text-sm font-medium">{title}</h4>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-b-lg border border-t-0 p-4 bg-muted/20">
            <p className={cn(
              "text-sm whitespace-pre-wrap",
              isEmpty && "text-muted-foreground italic"
            )}>
              {isEmpty ? emptyText : content}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <p className={cn(
        "text-sm whitespace-pre-wrap",
        isEmpty && "text-muted-foreground italic"
      )}>
        {isEmpty ? emptyText : content}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/detail-section.tsx
git commit -m "feat: add DetailSection for narrative text fields with collapsible support"
```

---

### Task 15: CrossLinkBadge component

**Files:**
- Create: `src/components/drill-down/cross-link-badge.tsx`

- [ ] **Step 1: Create CrossLinkBadge**

Create `src/components/drill-down/cross-link-badge.tsx`:

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { FileText, Shield, ArrowRightLeft, AlertTriangle, GraduationCap, Package } from "lucide-react"
import { cn } from "@/lib/utils"

const domainConfig = {
  capa: { icon: Shield, label: 'CAPA', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  'change-action': { icon: ArrowRightLeft, label: 'CMID', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  document: { icon: FileText, label: 'DOC', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  nc: { icon: AlertTriangle, label: 'NC', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  training: { icon: GraduationCap, label: 'Training', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  batch: { icon: Package, label: 'Batch', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200' },
}

interface CrossLinkBadgeProps {
  domain: keyof typeof domainConfig
  id: string
  label?: string
  onClick: () => void
}

export function CrossLinkBadge({ domain, id, label, onClick }: CrossLinkBadgeProps) {
  const config = domainConfig[domain]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-pointer hover:opacity-80 transition-opacity gap-1 py-1",
        config.color
      )}
      onClick={onClick}
    >
      <Icon className="w-3 h-3" />
      {label ?? `${config.label}-${id}`}
    </Badge>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/cross-link-badge.tsx
git commit -m "feat: add CrossLinkBadge for cross-domain navigation links"
```

---

### Task 16: CompareDrawer component

**Files:**
- Create: `src/components/drill-down/compare-drawer.tsx`

- [ ] **Step 1: Create CompareDrawer**

Create `src/components/drill-down/compare-drawer.tsx`:

```tsx
"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface CompareField {
  key: string
  label: string
}

interface CompareDrawerProps<T extends Record<string, any>> {
  items: T[]
  fields: CompareField[]
  getItemLabel: (item: T) => string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompareDrawer<T extends Record<string, any>>({
  items,
  fields,
  getItemLabel,
  open,
  onOpenChange,
}: CompareDrawerProps<T>) {
  if (items.length < 2) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Comparing {items.length} items</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground w-[200px]">Field</th>
                  {items.map((item, i) => (
                    <th key={i} className="text-left p-2 font-medium min-w-[200px]">
                      {getItemLabel(item)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map(field => {
                  const values = items.map(item => String(item[field.key] ?? ''))
                  const allSame = values.every(v => v === values[0])
                  return (
                    <tr key={field.key} className="border-b">
                      <td className="p-2 font-medium text-muted-foreground">{field.label}</td>
                      {values.map((val, i) => (
                        <td
                          key={i}
                          className={cn(
                            "p-2 whitespace-pre-wrap",
                            !allSame && "bg-amber-50 dark:bg-amber-950/20"
                          )}
                        >
                          {val || <span className="text-muted-foreground italic">Empty</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/compare-drawer.tsx
git commit -m "feat: add CompareDrawer for side-by-side item comparison"
```

---

### Task 16b: DrillDownDialog component

**Files:**
- Create: `src/components/drill-down/drill-down-dialog.tsx`

- [ ] **Step 1: Create DrillDownDialog**

Create `src/components/drill-down/drill-down-dialog.tsx`:

```tsx
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface DrillDownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onExportCsv?: () => void
  children: React.ReactNode
}

export function DrillDownDialog({
  open,
  onOpenChange,
  title,
  onExportCsv,
  children,
}: DrillDownDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            {onExportCsv && (
              <Button variant="outline" size="sm" onClick={onExportCsv}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            )}
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {children}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/drill-down-dialog.tsx
git commit -m "feat: add DrillDownDialog for lighter drill-down views"
```

---

### Task 17: Barrel export for drill-down components

**Files:**
- Create: `src/components/drill-down/index.ts`

- [ ] **Step 1: Create barrel export**

Create `src/components/drill-down/index.ts`:

```ts
export { DrillDownSheet, type Breadcrumb } from './drill-down-sheet'
export { DrillDownDialog } from './drill-down-dialog'
export { SummaryBar, type SummaryMetric } from './summary-bar'
export { InsightPanel, InsightCard } from './insight-panel'
export { FilterBar, type FilterConfig } from './filter-bar'
export { ExpandableDataTable, type ExpandableColumn } from './expandable-data-table'
export { DetailSection } from './detail-section'
export { CrossLinkBadge } from './cross-link-badge'
export { CompareDrawer } from './compare-drawer'
```

- [ ] **Step 2: Verify full build**

Run: `npm run typecheck && npm run build`
Expected: Build succeeds. This validates the entire framework compiles together.

- [ ] **Step 3: Commit**

```bash
git add src/components/drill-down/index.ts
git commit -m "feat: add barrel export for drill-down framework components"
```

---

## Phase 3: Dashboard Drill-Down Integrations

Each task adds drill-down interactivity to one dashboard. These tasks are independent and can be parallelized (each modifies a different file). Each task follows the same pattern: add state, add click handlers to existing charts, add new charts, wire up DrillDownSheet with domain-specific insight panels and data tables.

**Important context for all Phase 3 tasks:**
- Import drill-down components from `@/components/drill-down`
- Import `exportToCsv` from `@/lib/csv-export`
- Import `parseCrossReferences`, `findLinkedDocuments` from `@/lib/cross-references`
- Import `useData` from `@/contexts/data-context` (already imported in each dashboard)
- All charts use `hsl(var(--chart-N))` for colors where N is 1-5
- Date parsing uses date-fns `parse` with format `dd/MM/yyyy hh:mm a` for datetime fields

---

### Task 18: CAPA dashboard drill-downs

**Files:**
- Modify: `src/components/capa-dashboard.tsx`

This is a large task. The CAPA dashboard already has a basic Dialog for assignee drill-down. We need to:
1. Replace the Dialog with a DrillDownSheet
2. Add new charts (by Category, by Priority)
3. Add Level 2 single-CAPA view with narrative DetailSections
4. Make table rows clickable
5. Add cross-linking to Documents

- [ ] **Step 1: Add imports**

Add these imports at the top of `capa-dashboard.tsx`:

```tsx
import {
  DrillDownSheet,
  SummaryBar,
  InsightPanel,
  InsightCard,
  FilterBar,
  ExpandableDataTable,
  DetailSection,
  CrossLinkBadge,
  CompareDrawer,
  type SummaryMetric,
  type ExpandableColumn,
  type FilterConfig,
} from '@/components/drill-down'
import { exportToCsv } from '@/lib/csv-export'
import { findLinkedDocuments } from '@/lib/cross-references'
```

- [ ] **Step 2: Add drill-down state variables**

Add these state variables alongside the existing ones (around line 81-96):

```tsx
const [selectedCapaId, setSelectedCapaId] = React.useState<string | null>(null)
const [drillDownFilters, setDrillDownFilters] = React.useState<Record<string, any>>({})
const [compareIds, setCompareIds] = React.useState<Set<string>>(new Set())
const [compareOpen, setCompareOpen] = React.useState(false)
const [navigationLevel, setNavigationLevel] = React.useState<'list' | 'detail'>('list')
```

- [ ] **Step 3: Add computed data for assignee drill-down**

Add these useMemo blocks after the existing computations:

```tsx
const assigneeSummary = React.useMemo(() => {
  if (!selectedAssignee) return null
  const items = filteredData.filter((d: any) => d['Assigned To'] === selectedAssignee)
  const overdue = items.filter((d: any) => d.isOverdue).length
  const completed = items.filter((d: any) => !d['Pending Steps'] || d['Pending Steps'] === '').length
  const total = items.length
  const onTimeRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 0
  return { items, overdue, completed, total, onTimeRate }
}, [selectedAssignee, filteredData])

const selectedCapa = React.useMemo(() => {
  if (!selectedCapaId) return null
  return filteredData.find((d: any) => d['CAPA ID'] === selectedCapaId) ?? null
}, [selectedCapaId, filteredData])

const categoryChartData = React.useMemo(() => {
  const counts: Record<string, number> = {}
  filteredData.forEach((d: any) => {
    const cat = d['Category of Corrective Action'] || 'Uncategorized'
    counts[cat] = (counts[cat] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}, [filteredData])

const priorityChartData = React.useMemo(() => {
  const counts: Record<string, number> = {}
  filteredData.forEach((d: any) => {
    const priority = d['Priority'] || 'Unset'
    counts[priority] = (counts[priority] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}, [filteredData])
```

- [ ] **Step 4: Add new Category and Priority charts to the main dashboard**

In the JSX, after the existing `CapaChart` for "CAPAs by Assignee" and "CAPA Status Overview", add two new chart cards:

```tsx
<GlassCard className="p-4">
  <CapaChart
    data={categoryChartData}
    title="CAPAs by Category"
    dataKey="total"
    onBarClick={(name) => {
      setDrillDownFilters({ category: name })
      setSelectedAssignee('__category__' + name)
    }}
  />
</GlassCard>

<GlassCard className="p-4">
  <CapaChart
    data={priorityChartData}
    title="CAPAs by Priority"
    dataKey="total"
  />
</GlassCard>
```

- [ ] **Step 5: Replace the existing Dialog with DrillDownSheet**

Remove the existing `<Dialog>` block (lines ~461-487). Replace with the DrillDownSheet that handles both Level 1 (assignee list) and Level 2 (single CAPA detail):

```tsx
<DrillDownSheet
  open={!!selectedAssignee}
  onOpenChange={(open) => {
    if (!open) {
      setSelectedAssignee(null)
      setSelectedCapaId(null)
      setNavigationLevel('list')
    }
  }}
  title={navigationLevel === 'detail' && selectedCapa
    ? `CAPA-${selectedCapa['CAPA ID']}`
    : `CAPAs: ${selectedAssignee}`
  }
  breadcrumbs={navigationLevel === 'detail' ? [{
    label: `CAPAs: ${selectedAssignee}`,
    onClick: () => { setSelectedCapaId(null); setNavigationLevel('list') }
  }] : []}
  onExportCsv={() => {
    if (assigneeSummary) {
      exportToCsv(
        assigneeSummary.items,
        [
          { key: 'CAPA ID', header: 'CAPA ID' },
          { key: 'Title', header: 'Title' },
          { key: 'Priority', header: 'Priority' },
          { key: 'Category of Corrective Action', header: 'Category' },
          { key: 'Due Date', header: 'Due Date' },
          { key: 'Pending Steps', header: 'Status' },
        ],
        `capa_${selectedAssignee}_${new Date().toISOString().slice(0, 10)}.csv`
      )
    }
  }}
>
  {navigationLevel === 'list' && assigneeSummary && (
    <>
      <SummaryBar metrics={[
        { label: 'Total CAPAs', value: assigneeSummary.total },
        { label: 'Overdue', value: assigneeSummary.overdue, color: assigneeSummary.overdue > 0 ? 'danger' : 'success' },
        { label: 'On-Time Rate', value: `${assigneeSummary.onTimeRate}%`, color: assigneeSummary.onTimeRate >= 80 ? 'success' : 'warning' },
        { label: 'Completed', value: assigneeSummary.completed, color: 'success' },
      ]} />

      <InsightPanel>
        <InsightCard title="Priority Breakdown">
          {(() => {
            const items = assigneeSummary.items
            const counts: Record<string, number> = {}
            items.forEach((d: any) => {
              const p = d['Priority'] || 'Unset'
              counts[p] = (counts[p] || 0) + 1
            })
            const data = Object.entries(counts).map(([name, value]) => ({ name, value }))
            return (
              <div className="flex flex-wrap gap-2">
                {data.map(d => (
                  <Badge key={d.name} variant="outline">
                    {d.name}: {d.value}
                  </Badge>
                ))}
              </div>
            )
          })()}
        </InsightCard>
        <InsightCard title="Category Breakdown">
          {(() => {
            const items = assigneeSummary.items
            const counts: Record<string, number> = {}
            items.forEach((d: any) => {
              const c = d['Category of Corrective Action'] || 'Uncategorized'
              counts[c] = (counts[c] || 0) + 1
            })
            const data = Object.entries(counts).map(([name, value]) => ({ name, value }))
            return (
              <div className="flex flex-wrap gap-2">
                {data.map(d => (
                  <Badge key={d.name} variant="outline">
                    {d.name}: {d.value}
                  </Badge>
                ))}
              </div>
            )
          })()}
        </InsightCard>
      </InsightPanel>

      <ExpandableDataTable
        columns={[
          { key: 'CAPA ID', header: 'ID', sortable: true },
          { key: 'Title', header: 'Title' },
          { key: 'Priority', header: 'Priority', cell: (row: any) => (
            <Badge variant="outline">{row['Priority'] || 'Unset'}</Badge>
          )},
          { key: 'Category of Corrective Action', header: 'Category' },
          { key: 'effectiveDueDate', header: 'Due Date', sortable: true, cell: (row: any) =>
            row.effectiveDueDate ? row.effectiveDueDate.toLocaleDateString() : row['Due Date']
          },
          { key: 'Pending Steps', header: 'Status', cell: (row: any) => (
            <Badge variant={row.isOverdue ? 'destructive' : row['Pending Steps'] ? 'secondary' : 'default'}>
              {row['Pending Steps'] || 'Completed'}
            </Badge>
          )},
        ]}
        data={assigneeSummary.items}
        getRowId={(row: any) => row['CAPA ID']}
        onRowClick={(row: any) => {
          setSelectedCapaId(row['CAPA ID'])
          setNavigationLevel('detail')
        }}
        expandedContent={(row: any) => (
          <div className="space-y-2 text-sm">
            {row['Description'] && (
              <p><span className="font-medium">Description:</span> {row['Description'].slice(0, 200)}{row['Description'].length > 200 ? '...' : ''}</p>
            )}
            {row['Action plan'] && (
              <p><span className="font-medium">Action Plan:</span> {row['Action plan'].slice(0, 200)}{row['Action plan'].length > 200 ? '...' : ''}</p>
            )}
          </div>
        )}
        getRowClassName={(row: any) => row.isOverdue ? 'bg-destructive/10' : ''}
      />
    </>
  )}

  {navigationLevel === 'detail' && selectedCapa && (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="outline">{selectedCapa['Priority'] || 'No Priority'}</Badge>
        <Badge variant="outline">{selectedCapa['Category of Corrective Action'] || 'No Category'}</Badge>
        <Badge variant={selectedCapa.isOverdue ? 'destructive' : 'secondary'}>
          {selectedCapa['Pending Steps'] || 'Completed'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Assigned To:</span> {selectedCapa['Assigned To']}</div>
        <div><span className="text-muted-foreground">Proposed Responsible:</span> {selectedCapa['Proposed responsible'] || 'N/A'}</div>
        <div><span className="text-muted-foreground">Due Date:</span> {selectedCapa['Due Date']}</div>
        <div><span className="text-muted-foreground">Effectiveness Deadline:</span> {selectedCapa['Deadline for effectiveness check'] || 'N/A'}</div>
      </div>

      <DetailSection title="Description" content={selectedCapa['Description']} />
      <DetailSection title="Action Plan" content={selectedCapa['Action plan']} />
      <DetailSection title="Expected Results" content={selectedCapa['Expected results of Action']} />
      <DetailSection title="Action Taken" content={selectedCapa['Action taken']} defaultOpen={!!selectedCapa['Action taken']} />

      {/* Cross-linked documents */}
      {(() => {
        const { documentKpiData } = useData()
        const linkedDocs = findLinkedDocuments(documentKpiData as any[], 'capa', selectedCapa['CAPA ID'])
        if (linkedDocs.length === 0) return null
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Linked Documents</h4>
            <div className="flex flex-wrap gap-2">
              {linkedDocs.map((doc: any, i: number) => (
                <CrossLinkBadge
                  key={i}
                  domain="document"
                  id={doc['Doc Number']}
                  label={`${doc['Doc Prefix']}-${doc['Doc Number']}: ${doc['Title']}`}
                  onClick={() => {}}
                />
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )}
</DrillDownSheet>
```

Note: The cross-linking `useData()` call must be at the component's top level — in the actual implementation, extract `documentKpiData` from the existing `useData()` call at the top of the component. Don't call hooks inside render callbacks. Move the `const { documentKpiData } = useData()` destructuring to include `documentKpiData` in the existing useData() destructuring at the top.

- [ ] **Step 6: Add documentKpiData to the existing useData() call**

Find the existing `const { capaData, ... } = useData()` at the top of the component and add `documentKpiData`:

```tsx
const { capaData, documentKpiData, snapshots, refreshSnapshots } = useData()
```

And create a memo for linked documents:

```tsx
const linkedDocuments = React.useMemo(() => {
  if (!selectedCapaId || !documentKpiData) return []
  return findLinkedDocuments(documentKpiData as any[], 'capa', selectedCapaId)
}, [selectedCapaId, documentKpiData])
```

Then in the Level 2 view, replace the inline IIFE with:

```tsx
{linkedDocuments.length > 0 && (
  <div className="space-y-2">
    <h4 className="text-sm font-medium">Linked Documents</h4>
    <div className="flex flex-wrap gap-2">
      {linkedDocuments.map((doc: any, i: number) => (
        <CrossLinkBadge
          key={i}
          domain="document"
          id={doc['Doc Number']}
          label={`${doc['Doc Prefix']}-${doc['Doc Number']}: ${doc['Title']}`}
          onClick={() => {}}
        />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 7: Verify build**

Run: `npm run typecheck && npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Visual verification**

Run: `npm run dev`
Open the app, upload CAPA CSV. Click an assignee bar → Sheet opens with summary, insight panels, table. Click a table row → navigates to CAPA detail with narrative sections. Click back → returns to list.

- [ ] **Step 9: Commit**

```bash
git add src/components/capa-dashboard.tsx
git commit -m "feat: add CAPA drill-down with assignee sheet, CAPA detail view, cross-links"
```

---

### Task 19: Non-Conformance dashboard drill-downs

**Files:**
- Modify: `src/components/non-conformance-dashboard.tsx`

The NC dashboard is the richest drill-down. Replace the existing Dialog with DrillDownSheet, add the full NC case view with investigation narrative sections and corrective action indicators.

- [ ] **Step 1: Add imports**

Add at the top:

```tsx
import {
  DrillDownSheet,
  SummaryBar,
  InsightPanel,
  InsightCard,
  FilterBar,
  ExpandableDataTable,
  DetailSection,
  CrossLinkBadge,
  type ExpandableColumn,
} from '@/components/drill-down'
import { exportToCsv } from '@/lib/csv-export'
import { CheckCircle2, XCircle } from 'lucide-react'
```

- [ ] **Step 2: Add state for drill-down navigation**

Add after existing state variables:

```tsx
const [selectedNcId, setSelectedNcId] = React.useState<string | null>(null)
const [navigationLevel, setNavigationLevel] = React.useState<'list' | 'detail'>('list')
```

- [ ] **Step 3: Add computed data for quarter drill-down**

Add useMemo for the drill-down summary:

```tsx
const drillDownSummary = React.useMemo(() => {
  if (!dialogData) return null
  const items = dialogData.data as any[]
  const lowRisk = items.filter((d: any) => (d['Classification'] || '').toLowerCase().includes('low')).length
  const highRisk = items.filter((d: any) => (d['Classification'] || '').toLowerCase().includes('high')).length
  const withCompleted = items.filter((d: any) => d['Completed On'])
  const avgDaysToClose = withCompleted.length > 0
    ? Math.round(withCompleted.reduce((sum: number, d: any) => {
        const reg = d.registrationDate
        const comp = parse(d['Completed On'], 'dd/MM/yyyy hh:mm a', new Date())
        return sum + (isValid(comp) && isValid(reg) ? differenceInDays(comp, reg) : 0)
      }, 0) / withCompleted.length)
    : 0
  const reoccurring = items.filter((d: any) => (d['Reoccurrence'] || '').toUpperCase() === 'YES').length
  const reoccurrenceRate = items.length > 0 ? Math.round((reoccurring / items.length) * 100) : 0
  return { items, lowRisk, highRisk, avgDaysToClose, reoccurrenceRate }
}, [dialogData])

const selectedNc = React.useMemo(() => {
  if (!selectedNcId || !dialogData) return null
  return (dialogData.data as any[]).find((d: any) => String(d['Id']) === selectedNcId) ?? null
}, [selectedNcId, dialogData])
```

Note: You'll need to import `differenceInDays` from `date-fns` if not already imported.

- [ ] **Step 4: Replace Dialog with DrillDownSheet**

Remove the existing `<Dialog>` block. Replace with:

```tsx
<DrillDownSheet
  open={!!dialogData}
  onOpenChange={(open) => {
    if (!open) {
      setDialogData(null)
      setSelectedNcId(null)
      setNavigationLevel('list')
    }
  }}
  title={navigationLevel === 'detail' && selectedNc
    ? `NC-${selectedNc['Id']}`
    : dialogData?.title ?? ''
  }
  breadcrumbs={navigationLevel === 'detail' ? [{
    label: dialogData?.title ?? '',
    onClick: () => { setSelectedNcId(null); setNavigationLevel('list') }
  }] : []}
  onExportCsv={() => {
    if (drillDownSummary) {
      exportToCsv(
        drillDownSummary.items,
        [
          { key: 'Id', header: 'ID' },
          { key: 'Non Conformance Title', header: 'Title' },
          { key: 'Classification', header: 'Classification' },
          { key: 'Case Worker', header: 'Case Worker' },
          { key: 'Reoccurrence', header: 'Reoccurrence' },
          { key: 'Root cause description', header: 'Root Cause' },
          { key: 'Investigation summary', header: 'Investigation' },
        ],
        `nc_${dialogData?.title}_${new Date().toISOString().slice(0, 10)}.csv`
      )
    }
  }}
>
  {navigationLevel === 'list' && drillDownSummary && (
    <>
      <SummaryBar metrics={[
        { label: 'Total NCs', value: drillDownSummary.items.length },
        { label: 'Low Risk', value: drillDownSummary.lowRisk, color: 'success' },
        { label: 'High Risk', value: drillDownSummary.highRisk, color: drillDownSummary.highRisk > 0 ? 'danger' : 'success' },
        { label: 'Avg Days to Close', value: drillDownSummary.avgDaysToClose > 0 ? `${drillDownSummary.avgDaysToClose}d` : 'N/A' },
      ]} />

      <InsightPanel>
        <InsightCard title="Corrective Actions Taken">
          {(() => {
            const items = drillDownSummary.items
            const actions = [
              { label: 'Segregation', key: 'Segregation of product' },
              { label: 'Discarded', key: 'Discarded product' },
              { label: 'New Production', key: 'Started new production' },
              { label: 'Repeated Op.', key: 'Repeated operation/analysis' },
            ]
            return (
              <div className="grid grid-cols-2 gap-2">
                {actions.map(a => {
                  const count = items.filter((d: any) => d[a.key] && d[a.key].trim() !== '').length
                  return (
                    <div key={a.key} className="flex items-center justify-between rounded-md border p-2">
                      <span className="text-xs">{a.label}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </InsightCard>
        <InsightCard title="Case Worker Distribution">
          {(() => {
            const counts: Record<string, number> = {}
            drillDownSummary.items.forEach((d: any) => {
              const w = d['Case Worker'] || 'Unknown'
              counts[w] = (counts[w] || 0) + 1
            })
            return (
              <div className="space-y-1">
                {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            )
          })()}
        </InsightCard>
      </InsightPanel>

      <ExpandableDataTable
        columns={[
          { key: 'Id', header: 'ID', sortable: true },
          { key: 'Non Conformance Title', header: 'Title' },
          { key: 'Classification', header: 'Classification', cell: (row: any) => (
            <Badge variant={(row['Classification'] || '').toLowerCase().includes('high') ? 'destructive' : 'secondary'}>
              {row['Classification'] || 'N/A'}
            </Badge>
          )},
          { key: 'Case Worker', header: 'Case Worker' },
          { key: 'Reoccurrence', header: 'Reoccur.', cell: (row: any) => (
            <Badge variant={(row['Reoccurrence'] || '').toUpperCase() === 'YES' ? 'destructive' : 'outline'}>
              {row['Reoccurrence'] || 'N/A'}
            </Badge>
          )},
        ]}
        data={drillDownSummary.items}
        getRowId={(row: any) => String(row['Id'])}
        onRowClick={(row: any) => {
          setSelectedNcId(String(row['Id']))
          setNavigationLevel('detail')
        }}
        expandedContent={(row: any) => (
          <div className="space-y-2 text-sm">
            {row['Investigation summary'] && (
              <p><span className="font-medium">Investigation:</span> {row['Investigation summary'].slice(0, 200)}...</p>
            )}
            <div className="flex gap-2">
              {['Segregation of product', 'Discarded product', 'Started new production', 'Repeated operation/analysis'].map(key => (
                <span key={key} className="flex items-center gap-1 text-xs">
                  {row[key] && row[key].trim() !== ''
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    : <XCircle className="w-3 h-3 text-muted-foreground" />
                  }
                  {key.replace(' of product', '').replace('operation/analysis', 'op.')}
                </span>
              ))}
            </div>
          </div>
        )}
      />
    </>
  )}

  {navigationLevel === 'detail' && selectedNc && (
    <div className="space-y-4">
      <h3 className="font-semibold">{selectedNc['Non Conformance Title']}</h3>

      <div className="flex flex-wrap gap-2">
        <Badge variant={(selectedNc['Classification'] || '').toLowerCase().includes('high') ? 'destructive' : 'secondary'}>
          {selectedNc['Classification'] || 'Unclassified'}
        </Badge>
        <Badge variant={(selectedNc['Reoccurrence'] || '').toUpperCase() === 'YES' ? 'destructive' : 'outline'}>
          Reoccurrence: {selectedNc['Reoccurrence'] || 'N/A'}
        </Badge>
        <Badge variant="outline">{selectedNc['Status'] || 'Unknown'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Case Worker:</span> {selectedNc['Case Worker']}</div>
        <div><span className="text-muted-foreground">Registered By:</span> {selectedNc['Registered By']}</div>
        <div><span className="text-muted-foreground">Registration:</span> {selectedNc['Registration Time']}</div>
        <div><span className="text-muted-foreground">Completed:</span> {selectedNc['Completed On'] || 'Open'}</div>
      </div>

      <DetailSection title="Classification Justification" content={selectedNc['Classification justification']} />
      <DetailSection title="Impact Assessment" content={selectedNc['Impact Assessment']} />
      <DetailSection title="Investigation Summary" content={selectedNc['Investigation summary']} />
      <DetailSection title="Root Cause Description" content={selectedNc['Root cause description']} />
      <DetailSection title="Impact Other" content={selectedNc['Impact Other']} defaultOpen={false} />

      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium mb-3">Corrective Actions Taken</h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'Segregation of product', label: 'Segregation of Product' },
            { key: 'Discarded product', label: 'Discarded Product' },
            { key: 'Started new production', label: 'Started New Production' },
            { key: 'Repeated operation/analysis', label: 'Repeated Operation/Analysis' },
          ].map(({ key, label }) => {
            const active = selectedNc[key] && selectedNc[key].trim() !== ''
            return (
              <div key={key} className="flex items-center gap-2">
                {active
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <XCircle className="w-4 h-4 text-muted-foreground" />
                }
                <span className={active ? 'text-sm' : 'text-sm text-muted-foreground'}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )}
</DrillDownSheet>
```

- [ ] **Step 5: Verify build**

Run: `npm run typecheck && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Visual verification**

Run: `npm run dev`
Upload NC CSV. Click a risk bar → Sheet opens with corrective actions insight, case worker distribution, expandable table. Click NC row → detail view with investigation narrative, corrective action checkboxes.

- [ ] **Step 7: Commit**

```bash
git add src/components/non-conformance-dashboard.tsx
git commit -m "feat: add NC drill-down with investigation narrative, corrective actions, case worker insights"
```

---

### Task 20: Documents in Flow dashboard drill-downs

**Files:**
- Modify: `src/components/documents-in-flow-dashboard.tsx`

This dashboard needs the most work — going from 120 lines with zero interactivity to a full-featured dashboard with KPI cards, new charts, filters, and drill-downs.

- [ ] **Step 1: Add imports**

Add at the top:

```tsx
import {
  DrillDownSheet,
  SummaryBar,
  InsightPanel,
  InsightCard,
  ExpandableDataTable,
  DetailSection,
  CrossLinkBadge,
} from '@/components/drill-down'
import { exportToCsv } from '@/lib/csv-export'
import { parseCrossReferences } from '@/lib/cross-references'
import { differenceInDays } from 'date-fns'
```

- [ ] **Step 2: Add state and computed data**

Add state variables and enhance the existing useMemo computations:

```tsx
const [selectedAuthor, setSelectedAuthor] = React.useState<string | null>(null)
const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null)
const [selectedStatus, setSelectedStatus] = React.useState<string | null>(null)
const [navigationLevel, setNavigationLevel] = React.useState<'list' | 'detail'>('list')

const authorChartData = React.useMemo(() => {
  const counts: Record<string, number> = {}
  documentsInFlow.forEach((d: any) => {
    const author = d['Author'] || 'Unknown'
    counts[author] = (counts[author] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}, [documentsInFlow])

const kpiMetrics = React.useMemo(() => {
  const total = documentsInFlow.length
  const periodicReview = documentsInFlow.filter((d: any) =>
    (d['Periodic review of document'] || '').toLowerCase() === 'required'
  ).length
  const authorizedCopies = documentsInFlow.filter((d: any) =>
    (d['Authorized copy'] || '').toLowerCase() === 'yes'
  ).length
  return { total, periodicReview, authorizedCopies }
}, [documentsInFlow])

const authorDrillDownData = React.useMemo(() => {
  if (!selectedAuthor) return null
  const items = documentsInFlow.filter((d: any) => (d['Author'] || 'Unknown') === selectedAuthor)
  return items
}, [selectedAuthor, documentsInFlow])

const selectedDoc = React.useMemo(() => {
  if (!selectedDocId) return null
  return documentsInFlow.find((d: any) => d['Doc Number'] === selectedDocId) ?? null
}, [selectedDocId, documentsInFlow])
```

- [ ] **Step 3: Add KPI cards and Author chart to the main view**

Add KPI cards at the top of the dashboard JSX:

```tsx
<div className="grid grid-cols-3 gap-4 mb-6">
  <GlassCard className="p-4 text-center">
    <p className="text-sm text-muted-foreground">Total In Flow</p>
    <p className="text-3xl font-bold">{kpiMetrics.total}</p>
  </GlassCard>
  <GlassCard className="p-4 text-center">
    <p className="text-sm text-muted-foreground">Periodic Review Required</p>
    <p className="text-3xl font-bold">{kpiMetrics.periodicReview}</p>
  </GlassCard>
  <GlassCard className="p-4 text-center">
    <p className="text-sm text-muted-foreground">Authorized Copies</p>
    <p className="text-3xl font-bold">{kpiMetrics.authorizedCopies}</p>
  </GlassCard>
</div>
```

Add the Author chart alongside existing charts:

```tsx
<GlassCard className="p-4">
  <CapaChart
    data={authorChartData}
    title="Documents by Author"
    dataKey="total"
    onBarClick={setSelectedAuthor}
  />
</GlassCard>
```

- [ ] **Step 4: Make existing status bar chart clickable**

On the existing CapaChart for "Documents by Current Status", add an `onBarClick`:

```tsx
<CapaChart
  data={statusData}
  title="Documents by Current Status"
  dataKey="total"
  onBarClick={setSelectedStatus}
/>
```

- [ ] **Step 5: Update the DataTable to be clickable**

Replace the existing `<DataTable>` with an `<ExpandableDataTable>` that supports row click:

```tsx
<ExpandableDataTable
  columns={[
    { key: 'Doc Number', header: 'Doc Number', sortable: true, cell: (row: any) => `${row['Doc Prefix']}-${row['Doc Number']}` },
    { key: 'Title', header: 'Title' },
    { key: 'Author', header: 'Author' },
    { key: 'Version', header: 'Ver.' },
    { key: 'Document Flow', header: 'Revision Type', cell: (row: any) => {
      const flow = (row['Document Flow'] || '').toLowerCase()
      const variant = flow.includes('major') ? 'destructive' : flow.includes('minor') ? 'secondary' : 'default'
      return <Badge variant={variant}>{flow.includes('major') ? 'Major' : flow.includes('minor') ? 'Minor' : flow.includes('new') || flow.includes('create') ? 'New' : 'Other'}</Badge>
    }},
    { key: 'Pending Steps', header: 'Status', cell: (row: any) => <Badge variant="outline">{row['Pending Steps']}</Badge> },
  ]}
  data={documentsInFlow}
  getRowId={(row: any) => row['Doc Number']}
  onRowClick={(row: any) => {
    setSelectedDocId(row['Doc Number'])
    setSelectedAuthor(row['Author'] || '__doc_detail__')
    setNavigationLevel('detail')
  }}
  expandedContent={(row: any) => (
    <div className="space-y-1 text-sm">
      {row['Change Reason'] && <p><span className="font-medium">Change Reason:</span> {row['Change Reason'].slice(0, 200)}{row['Change Reason'].length > 200 ? '...' : ''}</p>}
      <p><span className="font-medium">Responsible:</span> {row['Responsible'] || 'N/A'}</p>
      <p><span className="font-medium">Distribution:</span> {row['Distribution List'] || 'N/A'}</p>
    </div>
  )}
/>
```

- [ ] **Step 6: Add Author DrillDownSheet**

Add after the main dashboard content:

```tsx
<DrillDownSheet
  open={!!selectedAuthor}
  onOpenChange={(open) => {
    if (!open) {
      setSelectedAuthor(null)
      setSelectedDocId(null)
      setNavigationLevel('list')
    }
  }}
  title={navigationLevel === 'detail' && selectedDoc
    ? `${selectedDoc['Doc Prefix']}-${selectedDoc['Doc Number']}`
    : `Documents: ${selectedAuthor}`
  }
  breadcrumbs={navigationLevel === 'detail' ? [{
    label: `Documents: ${selectedAuthor}`,
    onClick: () => { setSelectedDocId(null); setNavigationLevel('list') }
  }] : []}
  onExportCsv={() => {
    if (authorDrillDownData) {
      exportToCsv(authorDrillDownData, [
        { key: 'Doc Number', header: 'Doc Number' },
        { key: 'Title', header: 'Title' },
        { key: 'Version', header: 'Version' },
        { key: 'Document Flow', header: 'Revision Type' },
        { key: 'Pending Steps', header: 'Status' },
        { key: 'Change Reason', header: 'Change Reason' },
      ], `documents_${selectedAuthor}_${new Date().toISOString().slice(0, 10)}.csv`)
    }
  }}
>
  {navigationLevel === 'list' && authorDrillDownData && (
    <>
      <SummaryBar metrics={[
        { label: 'In Flow', value: authorDrillDownData.length },
        { label: 'Periodic Review', value: authorDrillDownData.filter((d: any) => (d['Periodic review of document'] || '').toLowerCase() === 'required').length },
        { label: 'Authorized Copies', value: authorDrillDownData.filter((d: any) => (d['Authorized copy'] || '').toLowerCase() === 'yes').length },
      ]} />

      <ExpandableDataTable
        columns={[
          { key: 'Doc Number', header: 'Doc#', sortable: true, cell: (row: any) => `${row['Doc Prefix']}-${row['Doc Number']}` },
          { key: 'Title', header: 'Title' },
          { key: 'Version', header: 'Ver.' },
          { key: 'Document Flow', header: 'Type', cell: (row: any) => {
            const flow = (row['Document Flow'] || '').toLowerCase()
            return <Badge variant="outline">{flow.includes('major') ? 'Major' : flow.includes('minor') ? 'Minor' : 'New'}</Badge>
          }},
          { key: 'Pending Steps', header: 'Status', cell: (row: any) => <Badge variant="outline">{row['Pending Steps']}</Badge> },
        ]}
        data={authorDrillDownData}
        getRowId={(row: any) => row['Doc Number']}
        onRowClick={(row: any) => {
          setSelectedDocId(row['Doc Number'])
          setNavigationLevel('detail')
        }}
        expandedContent={(row: any) => (
          <div className="text-sm">
            {row['Change Reason'] && <p><span className="font-medium">Change Reason:</span> {row['Change Reason']}</p>}
          </div>
        )}
      />
    </>
  )}

  {navigationLevel === 'detail' && selectedDoc && (
    <div className="space-y-4">
      <h3 className="font-semibold">{selectedDoc['Title']}</h3>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">v{selectedDoc['Version'] || '?'}</Badge>
        <Badge variant="outline">{selectedDoc['Document Flow']}</Badge>
        <Badge variant="outline">{selectedDoc['Pending Steps'] || 'Completed'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Author:</span> {selectedDoc['Author']}</div>
        <div><span className="text-muted-foreground">Responsible:</span> {selectedDoc['Responsible'] || 'N/A'}</div>
        <div><span className="text-muted-foreground">Version Date:</span> {selectedDoc['Version Date']}</div>
        <div><span className="text-muted-foreground">Completed:</span> {selectedDoc['Completed On'] || 'In progress'}</div>
      </div>

      <DetailSection title="Change Reason" content={selectedDoc['Change Reason']} />

      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium mb-2">Compliance</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Authorized Copy: <Badge variant="outline">{selectedDoc['Authorized copy'] || 'N/A'}</Badge></div>
          <div>Periodic Review: <Badge variant="outline">{selectedDoc['Periodic review of document'] || 'N/A'}</Badge></div>
        </div>
      </div>

      {selectedDoc['Distribution List'] && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-2">Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {selectedDoc['Distribution List'].split(',').map((team: string, i: number) => (
              <Badge key={i} variant="outline">{team.trim()}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Cross-links */}
      {(() => {
        const refs = parseCrossReferences(selectedDoc['Change Reason'])
        if (refs.length === 0) return null
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Linked Items</h4>
            <div className="flex flex-wrap gap-2">
              {refs.map((ref, i) => (
                <CrossLinkBadge
                  key={i}
                  domain={ref.domain === 'capa' ? 'capa' : 'change-action'}
                  id={ref.id}
                  label={`${ref.domain === 'capa' ? 'CAPA' : 'CMID'}-${ref.id}`}
                  onClick={() => {}}
                />
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )}
</DrillDownSheet>
```

- [ ] **Step 7: Verify build**

Run: `npm run typecheck && npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/documents-in-flow-dashboard.tsx
git commit -m "feat: reimagine documents dashboard with KPI cards, author chart, drill-downs, cross-links"
```

---

### Task 21: Change Action dashboard drill-downs

**Files:**
- Modify: `src/components/change-action-dashboard.tsx`

Replace Dialog with DrillDownSheet, add Responsible chart, add single action detail view.

- [ ] **Step 1: Add imports and state**

Add imports for drill-down components (same pattern as Tasks 18-20). Add state:

```tsx
const [selectedActionId, setSelectedActionId] = React.useState<string | null>(null)
const [navigationLevel, setNavigationLevel] = React.useState<'list' | 'detail'>('list')
```

- [ ] **Step 2: Add Responsible chart data**

```tsx
const responsibleChartData = React.useMemo(() => {
  const counts: Record<string, number> = {}
  processedData.forEach((d: any) => {
    const r = d['Responsible'] || 'Unknown'
    counts[r] = (counts[r] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}, [processedData])
```

- [ ] **Step 3: Add Responsible chart to main dashboard**

Add a new `CapaChart` for "Actions by Responsible":

```tsx
<GlassCard className="p-4">
  <CapaChart
    data={responsibleChartData}
    title="Actions by Responsible"
    dataKey="total"
  />
</GlassCard>
```

- [ ] **Step 4: Replace Dialog with DrillDownSheet**

Follow the same pattern as CAPA and NC dashboards:
- Level 1: Change ID summary + actions table
- Level 2: Single action detail with approval status badge, full "Action required" text as DetailSection, registration/deadline/completion dates
- SummaryBar: Total actions, Completed, Approved (new field), Overdue
- Add `documentKpiData` to useData() destructuring and show linked documents via CMID cross-reference

- [ ] **Step 5: Verify build and commit**

Run: `npm run typecheck && npm run build`

```bash
git add src/components/change-action-dashboard.tsx
git commit -m "feat: add change action drill-down with responsible chart, approval tracking, cross-links"
```

---

### Task 22: Training dashboard drill-downs

**Files:**
- Modify: `src/components/training-dashboard.tsx`

Make the stacked bar chart and pie chart clickable.

- [ ] **Step 1: Add imports and state**

Add drill-down imports. Add state:

```tsx
const [selectedTrainee, setSelectedTrainee] = React.useState<string | null>(null)
const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
const [selectedTrainingId, setSelectedTrainingId] = React.useState<string | null>(null)
const [navigationLevel, setNavigationLevel] = React.useState<'list' | 'detail'>('list')
```

- [ ] **Step 2: Make stacked bar chart clickable**

On the existing BarChart, add click handler on the Bar components. Since it's a stacked bar with 3 data keys, add `onClick` to the chart itself:

```tsx
<BarChart
  data={chartData}
  onClick={(e) => {
    if (e && e.activeLabel) setSelectedTrainee(e.activeLabel as string)
  }}
  style={{ cursor: 'pointer' }}
  // ... rest of existing props
>
```

- [ ] **Step 3: Make pie chart clickable**

On the existing PieChart, add click handler to the Pie component:

```tsx
<Pie
  data={pieData}
  onClick={(data) => {
    if (data && data.name) setSelectedCategory(data.name)
  }}
  style={{ cursor: 'pointer' }}
  // ... rest of existing props
/>
```

- [ ] **Step 4: Add Trainee DrillDownSheet**

Sheet opens when a trainee bar is clicked:
- SummaryBar: Total, Completed, Overdue, Approved (new field count)
- InsightPanel: Category breakdown, Approval status badges
- ExpandableDataTable: Title, Category, Deadline, Completed On, Approval, Status
- Row click → Level 2: Single training detail with pending steps as DetailSection

- [ ] **Step 5: Add Category DrillDownSheet**

Sheet opens when a pie slice is clicked:
- SummaryBar: Total in category, Completion rate, Overdue count, Unique trainees
- ExpandableDataTable: same columns, filtered to category
- Row click → Level 2: Single training detail

- [ ] **Step 6: Verify build and commit**

Run: `npm run typecheck && npm run build`

```bash
git add src/components/training-dashboard.tsx
git commit -m "feat: add training drill-down with trainee sheet, category sheet, approval tracking"
```

---

### Task 23: Batch Release dashboard drill-downs

**Files:**
- Modify: `src/components/batch-release-dashboard.tsx`

Add Product Name chart, make monthly bar clickable, add data table.

- [ ] **Step 1: Add imports and state**

Add drill-down imports. Add state:

```tsx
const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null)
const [selectedProduct, setSelectedProduct] = React.useState<string | null>(null)
const [selectedBatchId, setSelectedBatchId] = React.useState<string | null>(null)
const [navigationLevel, setNavigationLevel] = React.useState<'list' | 'detail'>('list')
```

- [ ] **Step 2: Add Product Name chart data**

```tsx
const productChartData = React.useMemo(() => {
  const counts: Record<string, number> = {}
  filteredData.forEach((d: any) => {
    const name = d['Product Name'] || 'Unknown'
    counts[name] = (counts[name] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}, [filteredData])
```

- [ ] **Step 3: Add Product chart and data table to main dashboard**

Add CapaChart for products with `onBarClick={setSelectedProduct}`. Add ExpandableDataTable showing all batches with columns: Batch#, Product Name, Clone, Low NC, High NC, Customer.

- [ ] **Step 4: Make monthly bar chart clickable**

Add click handler to existing BarChart:

```tsx
onClick={(e) => {
  if (e && e.activeLabel) setSelectedMonth(e.activeLabel as string)
}}
```

- [ ] **Step 5: Add Month and Product DrillDownSheets**

- Month Sheet: SummaryBar (batch count, avg NCs), InsightPanel (NC spread, product breakdown), table of batches
- Product Sheet: SummaryBar (batches, avg NCs, clone count), table of batches for product
- Level 2: Single batch detail (both batch numbers, project, product, NCs, customer)

- [ ] **Step 6: Verify build and commit**

Run: `npm run typecheck && npm run build`

```bash
git add src/components/batch-release-dashboard.tsx
git commit -m "feat: add batch release drill-down with product chart, month sheet, batch detail"
```

---

### Task 24: Compendium dashboard drill-through

**Files:**
- Modify: `src/components/compendium-dashboard.tsx`

Make the overdue bar chart and NC charts clickable, linking to domain-specific drill-downs.

- [ ] **Step 1: Add imports and state**

```tsx
import {
  DrillDownSheet,
  SummaryBar,
  ExpandableDataTable,
} from '@/components/drill-down'

const [drillThroughDomain, setDrillThroughDomain] = React.useState<string | null>(null)
const [drillThroughData, setDrillThroughData] = React.useState<{ title: string; items: any[] } | null>(null)
```

- [ ] **Step 2: Make overdue bar chart clickable**

On the existing overdue BarChart, add click handler:

```tsx
<Bar
  dataKey="count"
  cursor="pointer"
  onClick={(data: any) => {
    if (!data || !data.name) return
    const name = data.name as string
    let items: any[] = []
    if (name.includes('Non-Conformance')) {
      items = nonConformanceData.filter((d: any) => d['Pending Steps'] && d['Pending Steps'] !== '')
    } else if (name.includes('CAPA') && name.includes('Exec')) {
      items = capaData.filter((d: any) => d.isOverdue && (d['Pending Steps'] || '').includes('Execution'))
    } else if (name.includes('CAPA') && name.includes('Eff')) {
      items = capaData.filter((d: any) => d.isOverdue && (d['Pending Steps'] || '').includes('Effectiveness'))
    } else if (name.includes('Change')) {
      items = changeActionData.filter((d: any) => d.isOverdue)
    } else if (name.includes('Training')) {
      items = trainingData.filter((d: any) => {
        const deadline = d['Deadline for completing training']
        return d['Pending Steps'] && deadline && new Date(deadline) < new Date()
      })
    }
    setDrillThroughData({ title: `Overdue: ${name}`, items })
  }}
/>
```

- [ ] **Step 3: Add DrillDownSheet for drill-through**

Simple sheet showing the overdue items with a table:

```tsx
<DrillDownSheet
  open={!!drillThroughData}
  onOpenChange={(open) => !open && setDrillThroughData(null)}
  title={drillThroughData?.title ?? ''}
>
  <SummaryBar metrics={[
    { label: 'Overdue Items', value: drillThroughData?.items.length ?? 0, color: 'danger' },
  ]} />
  <ExpandableDataTable
    columns={[
      { key: 'id', header: 'ID', cell: (row: any) => row['CAPA ID'] || row['Id'] || row['Change_ActionID'] || row['Record training ID'] || '' },
      { key: 'title', header: 'Title', cell: (row: any) => row['Title'] || row['Non Conformance Title'] || '' },
      { key: 'responsible', header: 'Responsible', cell: (row: any) => row['Assigned To'] || row['Case Worker'] || row['Responsible'] || row['Trainee'] || '' },
    ]}
    data={drillThroughData?.items ?? []}
    getRowId={(row: any) => String(row['CAPA ID'] || row['Id'] || row['Change_ActionID'] || row['Record training ID'] || Math.random())}
  />
</DrillDownSheet>
```

- [ ] **Step 4: Verify build and commit**

Run: `npm run typecheck && npm run build`

```bash
git add src/components/compendium-dashboard.tsx
git commit -m "feat: add compendium drill-through for overdue items"
```

---

## Phase 4: Final Verification

---

### Task 25: Full integration test

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: No new errors.

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual end-to-end verification**

Run: `npm run dev`

Upload all 6 CSV files. For each dashboard, verify:
1. Charts are clickable where specified
2. DrillDownSheet opens with correct data
3. SummaryBar shows correct metrics
4. InsightPanel shows relevant charts/data
5. ExpandableDataTable rows expand and show detail
6. Row click navigates to Level 2 detail view
7. Back navigation returns to Level 1
8. Export CSV downloads a file
9. Cross-link badges appear when documents reference CAPAs/CMIDs
10. New data fields (Priority, Category, Investigation summary, etc.) are visible in drill-downs

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration adjustments from end-to-end testing"
```

---

## Appendix: Known Gaps for Follow-Up

The self-review identified these items as partially specified. They should be addressed during or immediately after Phase 3 implementation:

### A. Tasks 21-23 need full JSX during implementation

Tasks 21 (Change Action), 22 (Training), and 23 (Batch Release) describe the pattern in prose but have less complete JSX than Tasks 18-20. The implementing agent should follow the pattern established by the CAPA (Task 18) and NC (Task 19) tasks as a template — same DrillDownSheet structure, SummaryBar, InsightPanel, ExpandableDataTable, Level 2 detail view.

### B. Missing main-dashboard additions

The spec calls for additions to the main dashboard views that are not yet in the plan:
- **NC dashboard:** Add 4 KPI cards (Total open, Avg time-to-close, Reoccurrence rate, Corrective action summary) and 2 new charts (NCs by Case Worker, Corrective Actions Overview)
- **Documents dashboard:** Add Distribution Team chart, Doc Prefix chart, main-level filters
- **Change Action dashboard:** Add Approval Status Pipeline stacked bar chart
- **Batch Release dashboard:** Add NC Distribution scatter chart, Batches by Customer chart

These should be added as sub-steps within the respective dashboard tasks during implementation.

### C. Cross-link navigation is wired but passive

CrossLinkBadge `onClick` handlers in Tasks 18 and 20 are currently no-ops (`onClick={() => {}}`). To make cross-domain navigation fully functional, the implementing agent needs to:
1. Lift the drill-down state to a shared level, or
2. Use a callback pattern where clicking a cross-link opens the target domain's drill-down

Recommendation: implement as separate Task 26 after Phase 3 is complete, since it requires coordination across multiple dashboard components.

### D. Compendium delta dialog

The spec describes a Delta Dialog showing "New this period" vs "Resolved this period" when clicking bi-weekly delta values. This should be added as a sub-step in Task 24 during implementation.

### E. Navigation stack depth

The plan uses simple `'list' | 'detail'` state for 2-level navigation. The spec describes 3+ levels (e.g., Document → CAPA → linked NC). Extending to a proper stack (`navigationStack: Array<{level, title, data}>`) should be done in a follow-up task once the basic 2-level pattern is proven.
