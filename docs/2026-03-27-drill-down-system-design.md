# Design Spec: Interactive Chart Drill-Down System

**Date:** 2026-03-27
**Status:** Draft — pending user review

---

## 1. Overview

Transform the KPI Insights dashboard from a view-only reporting tool into a fully interactive exploration platform. Every chart, graph, and KPI card becomes a clickable entry point into rich, multi-level drill-down panels with sub-charts, inline filtering, exportable data, cross-domain linking, and comparison capabilities.

**Scope:** All 7 dashboards (CAPA, Batch Release, Change Action, Non-Conformance, Training, Documents in Flow, Compendium). This also requires integrating 31 new data fields and 1 renamed field from updated eQMS exports (detailed in `docs/newdata.md`).

---

## 2. Architecture: Shared Framework with Pluggable Insight Panels

### Why This Approach

Three approaches were considered:

| Approach | Pros | Cons |
|----------|------|------|
| **A) Monolithic per-dashboard** | Fast to build, fully custom | Massive duplication, inconsistent UX, hard to maintain |
| **B) Shared framework + pluggable panels** | Consistent navigation/filtering/export, custom visualizations per domain, maintainable | Moderate upfront investment in framework |
| **C) Config-driven renderer** | Maximum reuse, single component | Rigid, hard to customize, complex config schema |

**Chosen: Approach B.** It provides a consistent user experience (navigation, filtering, tables, export all work the same everywhere) while allowing each dashboard to define its own insight panels with domain-specific visualizations. This matches the "hybrid" design decision.

### Component Architecture

```
DrillDownSheet (or DrillDownDialog)
├── BreadcrumbNav          ← shared: navigation history + back button
├── SummaryBar             ← shared: row of configurable KPI mini-cards
├── InsightPanel           ← CUSTOM per dashboard: grid of sub-charts
├── FilterBar              ← shared: inline filters (select, multi-select, search, toggle)
├── ExpandableDataTable    ← shared: paginated table with expandable rows + row-click
├── DetailSection          ← shared: formatted text block for narrative fields
├── CrossLinkBadge         ← shared: clickable link to item in another domain
└── CompareDrawer          ← shared: side-by-side comparison of selected items
```

### Navigation Model

Multi-level drill-down uses a **nested panel stack** (iOS-style push navigation):

```
Level 0: Dashboard (main view)
  → Click chart element
Level 1: Sheet opens (e.g., "CAPAs: John Smith")
  → Click table row
Level 2: Nested panel slides in (e.g., "CAPA-281 Detail")
  → Click cross-link
Level 3: Cross-domain panel (e.g., "DOC-0001 linked via CAPA-281")
```

- Breadcrumb trail at top: `CAPA > John Smith > CAPA-281`
- Back arrow returns to previous level
- Panel state preserved when navigating deeper (scroll position, filters)
- ESC key or clicking outside closes entire stack

### State Management

Drill-down state lives in the component that owns the Sheet/Dialog, not in global context. Each drill-down maintains:
- `navigationStack: Array<{ level, title, data, filters }>` — for back navigation
- `selectedItems: Set<string>` — for compare mode
- `activeFilters: Record<string, any>` — for inline filtering

No changes to `DataContext` needed — drill-downs receive data from the parent dashboard via props.

---

## 3. Shared Components Specification

### 3.1 DrillDownSheet

Container component wrapping shadcn `Sheet` (side="right", ~60% width on desktop, full-width on mobile).

```tsx
interface DrillDownSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  breadcrumbs: { label: string; onClick: () => void }[]
  onExportCsv?: () => void
  onCompare?: () => void
  children: React.ReactNode
}
```

Features:
- Breadcrumb navigation bar at top
- Export CSV button (top right)
- Compare button (top right, toggles selection mode)
- ScrollArea for content
- Keyboard: ESC to close, arrow keys for breadcrumb navigation

### 3.2 DrillDownDialog

Lighter container wrapping shadcn `Dialog` for simpler views (max-w-4xl).
Same interface but without compare capability.

### 3.3 SummaryBar

Row of 2-5 mini KPI cards at the top of every drill-down.

```tsx
interface SummaryMetric {
  label: string
  value: string | number
  color?: 'default' | 'success' | 'warning' | 'danger'
  icon?: LucideIcon
  trend?: { value: number; label: string }
}

interface SummaryBarProps {
  metrics: SummaryMetric[]
}
```

### 3.4 InsightPanel

Grid container for sub-charts. Each dashboard provides its own chart content.

```tsx
interface InsightPanelProps {
  children: React.ReactNode
  columns?: 1 | 2  // default 2
}
```

Charts inside use the existing Recharts + shadcn `chart.tsx` wrapper. Sub-charts within drill-downs are clickable to push a new navigation level.

### 3.5 FilterBar

Inline filter row within drill-downs.

```tsx
interface FilterConfig {
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
```

### 3.6 ExpandableDataTable

Enhanced version of the existing `DataTable` with:
- Expandable rows (chevron toggle → reveals detail content below row)
- Row click → pushes new navigation level
- Checkbox column for compare selection
- Sortable columns (click header to sort)
- Highlight overdue/flagged rows

```tsx
interface ExpandableDataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  expandedContent?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  getRowClassName?: (row: T) => string
}
```

### 3.7 DetailSection

Formatted text block for narrative fields (NC investigation, CAPA description, etc.).

```tsx
interface DetailSectionProps {
  title: string
  content: string | undefined
  emptyText?: string  // shown when content is empty
  collapsible?: boolean
  defaultOpen?: boolean
}
```

Renders as: Card with title header, body text with preserved whitespace and line breaks. Collapsible sections default-open for the most important fields, collapsed for secondary.

### 3.8 CrossLinkBadge

Clickable badge that navigates to an item in another domain.

```tsx
interface CrossLinkBadgeProps {
  domain: 'capa' | 'change-action' | 'document' | 'nc' | 'training' | 'batch'
  id: string
  label: string
  onClick: () => void
}
```

Renders as: Badge with domain icon + label. Click pushes a cross-domain detail view onto the navigation stack.

### 3.9 CompareDrawer

Side-by-side comparison of 2-3 selected items. Opens as a full-width dialog.

```tsx
interface CompareDrawerProps<T> {
  items: T[]
  fields: { key: keyof T; label: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

Renders as: Column per item, rows per field. Highlights differences between items.

---

## 4. Per-Dashboard Drill-Down Designs

### 4.1 CAPA Dashboard

#### Main Dashboard Changes
- **Existing chart made clickable:** CAPAs by Assignee bar → Sheet
- **Existing chart made clickable:** Status Overview pie → Dialog
- **New chart:** CAPAs by Category (bar chart, using new `Category of Corrective Action` field) → Sheet
- **New chart:** CAPAs by Priority (donut, using new `Priority` field) → Dialog
- **Table rows:** Click → Sheet (single CAPA deep view)

#### Assignee Sheet (Level 1)

**SummaryBar:**
- Total CAPAs assigned
- Overdue count (red if >0)
- On-time rate (%)
- Avg days to close (from Due Date to Completed On)

**InsightPanel (2-column grid):**
1. **Workload Trend** (LineChart) — this assignee's CAPA count per month over time. Answers: "Is this person getting overloaded?"
2. **Priority Breakdown** (Donut) — distribution of Low/Normal/High priority CAPAs. Answers: "Are they handling critical items?"
3. **Category Breakdown** (HorizontalBar) — by Category of Corrective Action. Answers: "What kinds of issues are they dealing with?"
4. **Phase Split** (StackedBar) — Execution vs Effectiveness check. Answers: "Where in the lifecycle are their CAPAs?"

**FilterBar:** Phase | Status | Priority | Category | Date Range

**ExpandableDataTable columns:** CAPA ID, Title, Priority (badge), Category, Due Date, Status
- **Expanded row:** Description preview (first 200 chars), Action Plan preview, Pending Steps
- **Row click → Level 2:** Single CAPA deep view

#### Single CAPA View (Level 2)

Header block:
- Title, Priority badge, Category badge
- Assigned To, Proposed Responsible
- Phase (Execution/Effectiveness), Due Date, Status
- Time metrics: days open, days remaining or days overdue

**DetailSections (sequential — forms a narrative):**
1. **Description** — why this CAPA exists (default open)
2. **Action Plan** — what will be done (default open)
3. **Expected Results** — success criteria (default open)
4. **Action Taken** — what was actually done (default open if populated, collapsed if empty)

**CrossLinks:**
- Linked Documents: parsed from Document KPI `Change Reason` field matching this CAPA ID
- Pattern: regex `CAPA\s*0*{id}` in Change Reason text

---

### 4.2 Batch Release Dashboard

#### Main Dashboard Changes
- **Existing chart made clickable:** Monthly Approved Batches → Sheet
- **New chart:** Batches by Product Name (horizontal bar, top 10) → Sheet
- **New chart:** NC Distribution (scatter: each dot = batch, x=low-risk, y=high-risk) → click dot → Dialog
- **New chart:** Batches by Customer (horizontal bar) → Sheet
- **New: Add a data table** to main dashboard (currently none exists)
- **Table rows:** Click → Sheet (single batch deep view)

#### Month Sheet (Level 1)

**SummaryBar:**
- Total batches
- Avg Low Risk NCs per batch
- Avg High Risk NCs per batch
- Total NCs this month

**InsightPanel:**
1. **NC Spread** (Bar) — NCs per individual batch, sorted descending. Answers: "Are NCs concentrated or spread evenly?"
2. **By Product Name** (Donut) — batch count per product. Answers: "Which products dominated this month?"
3. **By Production Type** (Donut) — CL1000, Conjugation, etc.
4. **By Customer** (HorizontalBar) — which customers' batches were produced.

**FilterBar:** Product | Production Type | Customer | Clone

**ExpandableDataTable columns:** Batch# (canonical), Product Name, Clone, Low NC, High NC, Customer
- **Expanded row:** Both batch numbers, Project Number, Product Number, Production Type, Completed On
- **Row click → Level 2:** Single batch deep view

#### Product Sheet (Level 1 — from new chart)

**SummaryBar:**
- Total batches for this product
- Avg NCs per batch
- High risk rate
- Active clones count

**InsightPanel:**
1. **NC Trend** (Line) — NCs per batch over time for this product. Answers: "Is quality improving or degrading?"
2. **Clone Comparison** (GroupedBar) — NC rates per clone. Answers: "Which clone has best quality?"
3. **Customer Distribution** (Donut) — who receives this product
4. **Monthly Volume** (Bar) — production volume over time

#### Single Batch View (Level 2)

- Batch Number (canonical) + legacy batch number for traceability
- Project Number, Product Number, Product Name
- Clone Name, Production Type
- Customer (Company + aliases)
- Final Batch Status
- NC breakdown: Low risk count, High risk count, Total
- Completed On date

---

### 4.3 Change Action Dashboard

#### Main Dashboard Changes
- **Existing chart upgraded:** Actions by Change ID → Sheet (was Dialog)
- **Existing chart made clickable:** Monthly Registrations → Dialog
- **New chart:** Actions by Responsible (horizontal bar) → Sheet
- **New chart:** Approval Status Pipeline (stacked bar: Pending / Approved / Completed) → Dialog
- **Table rows:** Click → Sheet (single action deep view)

#### Change ID Sheet (Level 1)

**SummaryBar:**
- Total actions for this change
- Completed count
- Approved count
- Overdue count

**InsightPanel:**
1. **Action Timeline** (custom) — horizontal timeline showing each action from registration → deadline → completion. Color-coded: green (on time), red (overdue), amber (pending). Answers: "What's the lifecycle of this change?"
2. **By Responsible** (HorizontalBar) — who owns which actions in this change
3. **Status Pipeline** (StackedBar) — Pending → Approved → Completed funnel

**FilterBar:** Status | Responsible | Approval Status

**ExpandableDataTable columns:** Action ID, Action Required (truncated), Responsible, Deadline, Approval, Status
- **Expanded row:** Full "Action required" text, Registration Time, Completed On, time-to-complete
- **Row click → Level 2:** Single action deep view

**CrossLinks:**
- Linked Documents: parsed from Document KPI `Change Reason` matching this CMID
- Pattern: regex `CMID\s*0*{id}` in Change Reason text

#### Responsible Sheet (Level 1 — from new chart)

**SummaryBar:**
- Total actions assigned
- Overdue count
- Avg days to complete
- Approval rate

**InsightPanel:**
1. **Workload Trend** (Line) — actions assigned per month over time
2. **Change ID Distribution** (Donut) — across how many changes are they working?
3. **Status Breakdown** (StackedBar) — pending/approved/completed
4. **Completion Velocity** (Line) — avg days-to-complete trend over time

#### Single Action View (Level 2)

- Action ID, Change ID, Change Title
- Full "Action required prior to change" text (DetailSection)
- Responsible, Deadline, Registration Time
- Approval Status (badge)
- Completed On, time-to-complete calculation
- Pending Steps

---

### 4.4 Non-Conformance Dashboard — Richest Drill-Down

#### Main Dashboard Changes
- **Existing charts upgraded:** Risk bars + Reoccurrence line → Sheet (was Dialog)
- **New KPI cards (add 4):** Total open NCs, Avg time-to-close, Reoccurrence rate, Corrective action summary
- **New chart:** NCs by Case Worker (horizontal bar) → Sheet
- **New chart:** Corrective Actions Overview (stacked bar: 4 boolean fields aggregated) → Dialog
- **Table rows (add main table):** Click → Sheet (single NC case view)

#### Quarter Sheet (Level 1)

**SummaryBar:**
- Total NCs this quarter
- Low risk / High risk split
- Avg days to close
- Reoccurrence rate (%)

**InsightPanel:**
1. **Corrective Actions Taken** (StackedBar) — aggregate of 4 boolean fields across all NCs in this quarter. Bars: Segregation, Discarded, New Production, Repeated. Answers: "What corrective patterns are we seeing?"
2. **Case Worker Distribution** (HorizontalBar) — NCs per case worker. Answers: "Who is handling the load?"
3. **Reoccurrence Indicator** (Gauge/RadialBar) — % of reoccurring NCs this quarter
4. **Registered By** (Donut) — who is finding/reporting NCs. Answers: "Who finds the issues?"

**FilterBar:** Classification | Status | Case Worker | Reoccurrence (Yes/No) | Corrective Action Type

**ExpandableDataTable columns:** ID, Title, Classification (badge), Case Worker, Reoccurrence (badge), Days to Close
- **Expanded row:** Investigation summary (first 200 chars), Corrective action checkboxes (4 visual indicators), Impact Other
- **Row click → Level 2:** Full NC case view

#### Single NC Case View (Level 2) — The Richest Detail Panel

Header block:
- NC Title (full)
- Classification badge + justification tooltip
- Case Worker, Registered By
- Registration date, Completed On date
- Time to close (calculated), Reoccurrence badge
- Status

**DetailSections (investigation narrative — sequential reading order):**
1. **Classification Justification** — why this risk level was assigned (default open)
2. **Impact Assessment** — formal impact analysis (default open)
3. **Investigation Summary** — findings from investigation (default open)
4. **Root Cause Description** — identified root cause (default open)
5. **Impact Other** — additional impact notes (collapsed if "NA")

**Corrective Actions Block:**
Visual checklist with 4 indicators:
- Segregation of product: check/x
- Discarded product: check/x
- Started new production: check/x
- Repeated operation/analysis: check/x

**CrossLinks:**
- Linked CAPAs: if any CAPA title or description references this NC ID
- Linked Documents: if Change Reason references corrective actions from this NC

---

### 4.5 Training Dashboard

#### Main Dashboard Changes
- **Existing chart made clickable:** Stacked bar by Trainee → Sheet
- **Existing chart made clickable:** Category pie → Sheet
- **Table rows:** Click → Sheet (single training deep view)

#### Trainee Sheet (Level 1)

**SummaryBar:**
- Total assignments
- Completed count
- Overdue count
- Approved count (new field)

**InsightPanel:**
1. **Deadline vs Completion** (Scatter) — X=deadline date, Y=completion date. Dots above diagonal = late, below = early. Answers: "Is this person consistently on time?"
2. **Category Breakdown** (Donut) — which training types they have
3. **Approval Pipeline** (Progress bars) — Pending → Completed → Approved stages
4. **Completion Timeline** (Bar) — completions per month. Answers: "When do they complete trainings?"

**FilterBar:** Status | Category | Approval Status

**ExpandableDataTable columns:** Title, Category (badge), Deadline, Completed On, Approval Status (badge), Status (badge)
- **Expanded row:** Pending Steps (full text), Training ID, time to complete
- **Row click → Level 2:** Single training view

#### Category Sheet (Level 1 — from pie click)

**SummaryBar:**
- Total trainings in category
- Completion rate
- Overdue count
- Unique trainees

**InsightPanel:**
1. **Completion Rate Gauge** (RadialBar) — visual completion percentage
2. **Trainee Distribution** (HorizontalBar) — who has this training
3. **Status Breakdown** (StackedBar) — pending/completed/overdue
4. **Deadline Timeline** (Scatter/Line) — when are deadlines clustered?

#### Single Training View (Level 2)

- Training ID, Title
- Trainee, Category (badge)
- Deadline, Completed On (calculated: early/on-time/late + days)
- Pending Steps (DetailSection)
- Final Training Approval status

---

### 4.6 Documents in Flow Dashboard — Fully Reimagined

#### Main Dashboard Changes
- **Existing chart made clickable:** Revision Type pie → Sheet
- **Existing chart made clickable:** Status bar → Sheet
- **New KPI cards (add 4):** Total in flow, Periodic review required count, Authorized copies count, Avg days in flow
- **New chart:** Documents by Author (horizontal bar, top 10) → Sheet
- **New chart:** Documents by Distribution Team (horizontal bar) → Sheet
- **New chart:** Documents by Doc Prefix (bar) → Dialog
- **Add filters to main dashboard:** Author, Revision Type, Periodic Review, Authorized Copy, Distribution Team
- **Table upgraded:** Add Author, Version, Age columns
- **Table rows:** Click → Sheet (single document deep view)

#### Author Sheet (Level 1)

**SummaryBar:**
- Documents in flow
- Avg days in flow (calculated: today - Version Date, for items still in flow)
- Authorized copies count
- Periodic review required count

**InsightPanel:**
1. **Revision Types** (Donut) — major/minor/new breakdown for this author
2. **Pending Steps Distribution** (HorizontalBar) — what stages are their docs stuck at?
3. **Document Aging** (Bar) — each document as a bar showing days in flow, sorted descending. Highlights stale items.
4. **Distribution Teams** (badges/chips) — which teams receive this author's documents

**FilterBar:** Revision Type | Status | Periodic Review | Authorized Copy | Doc Prefix

**ExpandableDataTable columns:** Doc Number, Title, Version, Revision Type (badge), Status (badge), Age (days)
- **Expanded row:** Change Reason (full text), Responsible (approver), Distribution List, Periodic Review, Authorized Copy
- **Row click → Level 2:** Single document deep view

#### Single Document View (Level 2)

Header block:
- Doc Prefix + Number (e.g., DOC-0001_0003.1)
- Title (full)
- Version number
- Revision type badge (Major/Minor/New)
- Author, Responsible (approver role)
- Version Date, Completed On
- Current Status (Pending Steps or "Completed")
- Days in flow (calculated)

**DetailSections:**
1. **Change Reason** — why this document version exists (default open). This is the most valuable field — often contains rich context referencing CAPAs and change controls.

**Compliance Block:**
- Authorized Copy: Yes/No indicator
- Periodic Review: Required/Not Required indicator

**Distribution Block:**
- Distribution List shown as team badges

**CrossLinks:**
- Linked CAPAs: parsed from Change Reason (regex `CAPA\s*0*(\d+)`)
- Linked Change Actions: parsed from Change Reason (regex `CMID\s*0*(\d+)`)
- Click any link → pushes cross-domain detail view

#### Distribution Team Sheet (Level 1 — new chart)

**SummaryBar:**
- Total documents for this team
- In-flow count
- Periodic review required count
- Avg document version

**InsightPanel:**
1. **Revision Types** (Donut) — what kinds of changes affect this team?
2. **Author Distribution** (HorizontalBar) — who writes this team's documents?
3. **Aging** (Bar) — documents in flow sorted by age
4. **Status Pipeline** (StackedBar) — what steps are pending?

---

### 4.7 Compendium Dashboard — Drill-Through Hub

#### Main Dashboard Changes
All existing charts and metrics become clickable entry points:

- **NC Risk & Volume bars** → Opens NC Quarter Sheet (reuses NC dashboard's drill-down)
- **NC Reoccurrence line dots** → Opens NC Quarter Sheet filtered to reoccurring
- **Overdue bar chart: each bar** → Opens Sheet pre-filtered to overdue items for that domain
- **Documents in Flow summary cards** → Opens Document drill-down filtered by type
- **Bi-weekly delta values** → Dialog showing exactly which items changed

#### Overdue Drill-Through (Level 1)

When user clicks an overdue bar (e.g., "CAPA Exec: 3"), opens a Sheet using the CAPA framework but pre-filtered:
- FilterBar pre-set to: Phase=Execution, Status=Overdue
- Table shows only matching items
- Same InsightPanel charts but scoped to overdue items
- Same Level 2 navigation (click row → item detail)

This means the Compendium doesn't need its own drill-down components — it reuses the domain-specific ones with pre-applied filters.

#### Delta Dialog

When user clicks a delta value (e.g., "+2 CAPA Overdue since last period"):
- Dialog showing the specific items that changed
- Two-column layout: "New this period" and "Resolved this period"
- Each item clickable → navigates to domain drill-down

---

## 5. Cross-Domain Linking System

### How It Works

The `Change Reason` field in Document KPI contains natural-language references to CAPAs and Change Actions:
- `"CAPA281: Added field for signature of process performed"`
- `"CMID15: Change of company name from Diatec Monoclonals AS to Curida Diatec AS"`
- `"CMID101 Implementation of Corning CL1000, Change Action 578"`

A utility function parses these references:

```ts
interface CrossReference {
  domain: 'capa' | 'change-action'
  id: string
  rawMatch: string
}

function parseCrossReferences(changeReason: string): CrossReference[] {
  const refs: CrossReference[] = []
  // Match CAPA references: CAPA281, CAPA 281, CAPA073, etc.
  const capaPattern = /CAPA\s*0*(\d+)/gi
  // Match CMID references: CMID15, CMID 101, CMID015, etc.
  const cmidPattern = /CMID\s*0*(\d+)/gi
  // Match Change Action references: Change Action 578, CA600, etc.
  const caPattern = /(?:Change Action|CA)\s*0*(\d+)/gi
  // ... extract matches
  return refs
}
```

### Cross-Link Navigation

From **Document detail** → Click CAPA link → Pushes CAPA detail view (Level 3)
From **Document detail** → Click CMID link → Pushes Change Action detail (Level 3)
From **CAPA detail** → "Linked Documents" section shows documents whose Change Reason references this CAPA
From **Change Action detail** → "Linked Documents" section shows documents whose Change Reason references this CMID

This creates a navigable web:
```
Document ←→ CAPA
Document ←→ Change Action
CAPA ←→ NC (if CAPA references NC or vice versa)
```

---

## 6. Export System

Every drill-down Sheet has an "Export CSV" button that exports the currently filtered and visible data.

- Respects active filters (only exports what the user sees)
- Includes all fields (not just visible table columns)
- Filename pattern: `{domain}_{context}_{date}.csv` (e.g., `capa_john-smith_2026-03-27.csv`)
- Uses client-side CSV generation (no server round-trip)

---

## 7. Comparison Mode

Available in every Sheet-based drill-down:
1. Click "Compare" button → checkboxes appear on each table row
2. Select 2-3 items
3. Click "Compare Selected" → CompareDrawer opens
4. Side-by-side view with field-by-field comparison
5. Differences highlighted in amber

Most useful for:
- Comparing two CAPAs (action plans, expected results)
- Comparing NC investigations (root causes, corrective actions)
- Comparing batches (NC counts, products)

---

## 8. New Data Integration Requirements

All 31 new fields and 1 rename must be integrated before drill-downs can use them:

| Priority | Task | Fields |
|----------|------|--------|
| **P0 — Blocking** | Update `DocumentKpiData` type | +6 new, 1 rename |
| **P0 — Blocking** | Update `CapaData` type | +7 new |
| **P0 — Blocking** | Update NC inline interface | +10 new |
| **P0 — Blocking** | Update Batch Release inline interface + dedup | +4 new + computed field |
| **P0 — Blocking** | Update Change Action inline interface | +2 new |
| **P0 — Blocking** | Update Training inline interface | +2 new |
| **P1 — Framework** | Build shared drill-down components | 9 components |
| **P2 — Dashboards** | Implement per-dashboard drill-downs | 7 dashboards |
| **P3 — Cross-linking** | Build cross-reference parser + navigation | Utility + UI |
| **P4 — Polish** | Export, comparison mode, keyboard shortcuts | 3 features |

---

## 9. Files to Create / Modify

### New Files
- `src/components/drill-down/drill-down-sheet.tsx`
- `src/components/drill-down/drill-down-dialog.tsx`
- `src/components/drill-down/summary-bar.tsx`
- `src/components/drill-down/insight-panel.tsx`
- `src/components/drill-down/filter-bar.tsx`
- `src/components/drill-down/expandable-data-table.tsx`
- `src/components/drill-down/detail-section.tsx`
- `src/components/drill-down/cross-link-badge.tsx`
- `src/components/drill-down/compare-drawer.tsx`
- `src/lib/cross-references.ts` — parser for Change Reason links
- `src/lib/csv-export.ts` — client-side CSV export utility

### Modified Files
- `src/lib/types.ts` — update CapaData, DocumentKpiData
- `src/components/batch-release-dashboard.tsx` — new interface, dedup, charts, drill-downs
- `src/components/capa-dashboard.tsx` — new charts, drill-downs
- `src/components/change-action-dashboard.tsx` — new interface, charts, drill-downs
- `src/components/non-conformance-dashboard.tsx` — new interface, KPI cards, charts, drill-downs
- `src/components/training-dashboard.tsx` — new interface, clickable charts, drill-downs
- `src/components/documents-in-flow-dashboard.tsx` — rename, new interface, full reimagining
- `src/components/compendium-dashboard.tsx` — clickable charts, drill-through
- `src/components/data-table.tsx` — extend for expandable rows (or create new)
