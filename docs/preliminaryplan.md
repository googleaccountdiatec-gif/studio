# Interactive Chart Drill-Down System — Comprehensive Plan

**Date:** 2026-03-27 (updated)
**Status:** Implementation plan written and self-reviewed. Ready to execute.

> **Design spec:** [`docs/2026-03-27-drill-down-system-design.md`](./2026-03-27-drill-down-system-design.md) — approved by user
> **Implementation plan:** [`docs/superpowers/plans/2026-03-27-drill-down-system.md`](./superpowers/plans/2026-03-27-drill-down-system.md) — 25 tasks across 4 phases, self-reviewed with known gaps documented in appendix
> **Data field changes:** [`docs/newdata.md`](./newdata.md) (updated with 6 new Document KPI fields, 31 total new + 1 rename)

---

## Project Goal

Add rich, interactive drill-down pop-ups when charts/graphs are clicked across all dashboards. The drill-downs should be extensive, informative, and highly interactable — a full exploration experience with multi-level navigation, sub-charts, filtering, comparison, and search.

---

## Design Decisions Made

1. **Container type:** Hybrid — **Sheets (side drawers)** for data-heavy drill-downs (CAPA, NC, Training, Batch Release), **Dialogs** for simpler ones (Documents, Change Action quick views)
2. **Interactivity level:** Full exploration — sub-charts within drill-downs, export-to-CSV, cross-domain linking, multi-level drill-down, search, comparison mode
3. **Consistency model:** Hybrid framework — shared navigation/filtering/table/export components, with a **custom insight panel** unique to each dashboard showing domain-specific visualizations
4. **Multi-level navigation:** Nested panels (iOS-style) — each deeper level slides in on top, with back arrow. Breadcrumb trail at top. Comparison available as explicit action.

---

## Current State Analysis

### Dashboards With Existing Click Interactivity

| Dashboard | Chart | Click Behavior |
|-----------|-------|----------------|
| **CAPA** | CAPAs by Assignee (bar) | Opens Dialog with assignee's CAPA table |
| **Change Action** | Actions by Change ID (bar) | Opens Dialog with change ID detail table |
| **Non-Conformance** | Risk bars + Reoccurrence line | Opens Dialog with filtered records for quarter/type |

**Pattern used:** State variable → `Dialog` → `DataTable` inside.
**Limitations:** No filtering within the modal, no multi-level navigation, no summary stats, no charts inside drill-downs.

### Dashboards With NO Click Interactivity

| Dashboard | Charts Present |
|-----------|---------------|
| **Training** | Stacked bar (by trainee), Doughnut pie (categories) |
| **Batch Release** | Monthly approved batches bar |
| **Documents in Flow** | Doughnut pie (revision types), Bar (by status) |
| **Compendium** | NC bars, Reoccurrence line, Overdue horizontal bar |

---

## Complete Data Inventory (Current + New Fields)

### 1. CAPA (7 new fields)

| Field | Status | Currently Visualized? |
|-------|--------|----------------------|
| CAPA ID | existing | Table only |
| Title | existing | Table only |
| Due Date | existing | Table + KPI logic |
| Deadline for effectiveness check | existing | KPI logic only |
| Assigned To | existing | Chart + Table + Filter |
| Pending Steps | existing | Table + status logic |
| Completed On | existing | Status logic only |
| **Category of Corrective Action** | **NEW** | **No** |
| **Priority** | **NEW** | **No** |
| **Action taken** | **NEW** | **No** |
| **Expected results of Action** | **NEW** | **No** |
| **Action plan** | **NEW** | **No** |
| **Description** | **NEW** | **No** |
| **Proposed responsible** | **NEW** | **No** |

### 2. Batch Release (4 new fields + dedup logic)

| Field | Status | Currently Visualized? |
|-------|--------|----------------------|
| Batch number | existing | ID only |
| Final batch status | existing | Filter only (hard-coded to "Approved") |
| Clone name | existing | Filter only |
| High-risk nonconformance | existing | KPI aggregate |
| Low-risk nonconformances | existing | KPI aggregate |
| Type of Production | existing | Filter only |
| Company | existing | Filter only |
| Company aliases | existing | Filter logic only |
| Completed On | existing | Date logic only |
| **Project Number** | **NEW** | **No** |
| **Product number** | **NEW** | **No** |
| **Product Name** | **NEW** | **No** |
| **Batch number from list** | **NEW** | **No** (needs dedup) |

### 3. Change Action (2 new fields)

| Field | Status | Currently Visualized? |
|-------|--------|----------------------|
| Change_ActionID | existing | Table |
| Action required prior to change | existing | Table |
| Responsible | existing | Table + Filter |
| Pending Steps | existing | Status logic |
| Deadline | existing | Table + overdue logic |
| Change Title | existing | Dialog header only |
| Change ID (CMID) | existing | Chart + Table |
| Registration Time | existing | Monthly chart aggregation |
| **Approve** | **NEW** | **No** |
| **Completed On** | **NEW** | **No** |

### 4. Non-Conformance (10 new fields)

| Field | Status | Currently Visualized? |
|-------|--------|----------------------|
| Id | existing | Detail dialog table |
| Non Conformance Title | existing | Detail dialog table |
| Classification | existing | Chart bars |
| Pending Steps | existing | **Never shown** |
| Case Worker | existing | **Filter logic only** |
| Status | existing | Detail dialog table |
| Registration Time | existing | Quarter bucketing |
| Registered By | existing | **Filter logic only** |
| Reoccurrence | existing | Line chart |
| **Completed On** | **NEW** | **No** |
| **Impact Other** | **NEW** | **No** |
| **Investigation summary** | **NEW** | **No** |
| **Impact Assessment** | **NEW** | **No** |
| **Root cause description** | **NEW** | **No** |
| **Classification justification** | **NEW** | **No** |
| **Segregation of product** | **NEW** | **No** (boolean) |
| **Discarded product** | **NEW** | **No** (boolean) |
| **Started new production** | **NEW** | **No** (boolean) |
| **Repeated operation/analysis** | **NEW** | **No** (boolean) |

### 5. Training (2 new fields)

| Field | Status | Currently Visualized? |
|-------|--------|----------------------|
| Record training ID | existing | Never shown |
| Title | existing | Table |
| Trainee | existing | Chart + Table |
| Training category | existing | Pie chart + Table badge |
| Deadline for completing training | existing | Table + overdue logic |
| Pending Steps | existing | WIP tooltip only |
| **Final training approval** | **NEW** | **No** |
| **Completed On** | **NEW** | **No** |

### 6. Document KPI (6 new fields + 1 rename)

| Field | Status | Currently Visualized? |
|-------|--------|----------------------|
| Doc Prefix | existing | Combined into doc number |
| Doc Number | existing | Table |
| Title | existing | Table |
| Version Date | existing | Never analyzed |
| Document Flow | existing | Pie chart |
| Pending Steps | existing | Bar chart + Table badge |
| Completed On | existing | Never shown |
| Author | **RENAMED** (was Responsible) | **Never shown** |
| **Version** | **NEW** | **No** |
| **Change Reason** | **NEW** | **No** — references CAPAs/CMIDs (cross-linking!) |
| **Responsible** | **NEW** (approver role) | **No** |
| **Authorized copy** | **NEW** | **No** (Yes: 131, No: 275) |
| **Periodic review of document** | **NEW** | **No** (Required: 110, Not required: 288) |
| **Distribution List** | **NEW** | **No** (40+ distinct team combinations) |

---

## Cross-Domain Linking Opportunities

The **Change Reason** field in Documents contains explicit references to CAPAs and CMIDs:
- `"CAPA281: Added field for signature..."` → links to CAPA ID 281
- `"CMID15: Change of company name..."` → links to Change ID 15
- `"CMID101 Implementation of Corning CL1000, Change Action 578..."` → links to both

This enables **cross-domain navigation**: from a Document drill-down, jump to the related CAPA or Change Action, and vice versa.

---

## Per-Dashboard Drill-Down Design

### 1. CAPA Dashboard

**Clickable elements on main dashboard:**
- Bar chart: CAPAs by Assignee → **Sheet**
- Pie chart: Status Overview → **Dialog**
- NEW chart: CAPAs by Category → **Sheet**
- NEW chart: CAPAs by Priority → **Dialog**
- Table rows → **Sheet** (single CAPA deep view)

**Assignee Sheet (Level 1):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back    CAPAs: John Smith    [Export CSV] [Compare]│
│─────────────────────────────────────────────────────│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ Total  │ │Overdue │ │On-Time │ │Avg Days│        │
│ │   12   │ │   3    │ │  75%   │ │  34d   │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                     │
│ [Insight Panel - CAPA Specific]                     │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Workload Trend      │ │ Priority Breakdown   │    │
│ │ (line: CAPAs/month) │ │ (donut: H/N/L)      │    │
│ └─────────────────────┘ └─────────────────────┘    │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Category Breakdown  │ │ Phase Split          │    │
│ │ (bar: by category)  │ │ (bar: Exec vs Eff)  │    │
│ └─────────────────────┘ └─────────────────────┘    │
│                                                     │
│ [Filters: Phase | Status | Priority | Date Range]   │
│ ┌───────────────────────────────────────────────┐   │
│ │ CAPA Table (expandable rows)                  │   │
│ │ ID | Title | Priority | Category | Due | Stat │   │
│ │ ▶ CAPA-281 | Repair alarm... | Low | Equip...│   │
│ │ ▶ CAPA-293 | Update SOP... | Normal | Sys... │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Single CAPA Deep View (Level 2 — nested panel):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back to John Smith    CAPA-281                    │
│─────────────────────────────────────────────────────│
│ Title: Repair of alarm sound in DIA025              │
│ Priority: Low  |  Category: Equipment / premises    │
│ Assigned To: Jim Eero Lamppu                        │
│ Proposed Responsible: (none)                        │
│ Status: Execution  |  Due: 30/06/2026               │
│─────────────────────────────────────────────────────│
│                                                     │
│ [Description]                                       │
│ ┌───────────────────────────────────────────────┐   │
│ │ (formatted text block)                        │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Action Plan]                                       │
│ ┌───────────────────────────────────────────────┐   │
│ │ Repair of alarm sound by service supplier...  │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Expected Results]                                  │
│ ┌───────────────────────────────────────────────┐   │
│ │ This CAPA is considered effective if...        │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Action Taken]                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ (empty — not yet completed)                   │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Linked Documents]  ← parsed from Document KPI      │
│ • DOC-0001 "Thawing and expansion of cells" (v5.0)  │
│   Change Reason: "CAPA281: Added field for..."      │
└─────────────────────────────────────────────────────┘
```

**Why this design for CAPA:**
- The new narrative fields (Description, Action plan, Expected results, Action taken) form a natural **story arc** — they should be read top-to-bottom, not crammed into table cells
- Priority and Category enable new aggregation views that didn't exist before
- Linked Documents via Change Reason cross-referencing surfaces hidden relationships
- Workload trend per assignee answers "is this person getting overloaded?"

---

### 2. Batch Release Dashboard

**Clickable elements on main dashboard:**
- Bar chart: Monthly Approved Batches → **Sheet**
- KPI card: Avg NCs → **Sheet** (NC distribution view)
- NEW chart: Batches by Product Name → **Sheet**
- NEW chart: NC Distribution (scatter) → **Dialog** (quick view)
- Table rows (new — add a data table) → **Sheet** (single batch)

**Month Sheet (Level 1):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back    March 2024 Batches    [Export CSV]        │
│─────────────────────────────────────────────────────│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │Batches │ │Avg Low │ │Avg High│ │ Total  │        │
│ │   8    │ │  1.2   │ │  0.4   │ │  1.6   │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                     │
│ [Insight Panel - Batch Specific]                    │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ NC Spread           │ │ By Product Name     │    │
│ │ (bar: NCs per batch)│ │ (pie: batch count)  │    │
│ └─────────────────────┘ └─────────────────────┘    │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ By Production Type  │ │ By Customer         │    │
│ │ (donut)             │ │ (horizontal bar)    │    │
│ └─────────────────────┘ └─────────────────────┘    │
│                                                     │
│ [Filters: Product | Type | Customer | Clone]        │
│ ┌───────────────────────────────────────────────┐   │
│ │ Batch Table                                   │   │
│ │ Batch# | Product | Clone | Low | High | Cust  │   │
│ │ ▶ B8794 | Anti-Calp | mAb12 | 3 | 0 | Calpro│   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Single Batch Deep View (Level 2):**
- Both batch numbers (canonical + legacy) for traceability
- Project number and product details
- NC breakdown: low vs high risk counts
- Production type, clone name, customer
- Completion date and timeline position

**Product Sheet (Level 1 — from new Product Name chart):**
- All batches for this product across time
- NC trend for this specific product (are NCs increasing?)
- Clone comparison within product
- Customer distribution

**Why this design for Batch Release:**
- Product Name and Project Number are the biggest wins — they enable grouping batches by what they actually produce, not just when they were made
- NC spread chart answers "are NCs concentrated in a few bad batches or evenly distributed?"
- Customer view answers "which customers are seeing quality issues?"
- Both batch numbers shown for audit trail compliance

---

### 3. Change Action Dashboard

**Clickable elements on main dashboard:**
- Bar chart: Actions by Change ID → **Sheet**
- Bar chart: Monthly Registrations → **Dialog**
- NEW chart: Actions by Responsible → **Sheet**
- NEW chart: Approval Pipeline (funnel/status) → **Dialog**
- Table rows → **Sheet** (single action deep view)

**Change ID Sheet (Level 1):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back    CMID-123: Software update BizzMine        │
│─────────────────────────────────────────────────────│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │Actions │ │Complete│ │Approved│ │Overdue │        │
│ │   4    │ │   1    │ │   2    │ │   0    │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                     │
│ [Insight Panel - Change Action Specific]            │
│ ┌───────────────────────────────────────────────┐   │
│ │ Action Timeline                               │   │
│ │ ──●────────●─────────●──────────→ deadline    │   │
│ │   reg     approved   completed                │   │
│ └───────────────────────────────────────────────┘   │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ By Responsible      │ │ Status Pipeline     │    │
│ │ (bar: who owns what)│ │ (funnel: stages)    │    │
│ └─────────────────────┘ └─────────────────────┘    │
│                                                     │
│ [Filters: Status | Responsible | Approval]          │
│ ┌───────────────────────────────────────────────┐   │
│ │ Actions Table (expandable)                    │   │
│ │ ID | Action Required | Resp | Deadline | Stat │   │
│ │ ▶ 657 | Draft user-guide... | Joakim | 15/04│   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Linked Documents]  ← parsed from Document KPI      │
│ • DOC-0042 v6.0: "CMID101 Implementation..."       │
└─────────────────────────────────────────────────────┘
```

**Why this design for Change Action:**
- The timeline view (registration → approval → completion) tells the lifecycle story that raw dates can't
- Approve and Completed On enable a pipeline/funnel showing workflow stage distribution
- Cross-linking to Documents via CMID references in Change Reason
- Registration-vs-completion trend overlay answers "are we keeping up or falling behind?"

---

### 4. Non-Conformance Dashboard — The Richest Drill-Down

**Clickable elements on main dashboard:**
- Bar chart: Risk & Volume per quarter → **Sheet**
- Line chart: Reoccurrence trend dots → **Sheet**
- NEW chart: NCs by Case Worker → **Sheet**
- NEW KPI cards (add): Total open, Avg time-to-close, Corrective action breakdown
- Table rows → **Sheet** (single NC case view)

**Quarter Sheet (Level 1):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back    2025-Q4 Non-Conformances    [Export CSV]  │
│─────────────────────────────────────────────────────│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ Total  │ │Low Risk│ │Hi Risk │ │Avg Days│        │
│ │   14   │ │   9    │ │   5    │ │  23d   │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                     │
│ [Insight Panel - NC Specific]                       │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Corrective Actions  │ │ Case Worker Split   │    │
│ │ ┌──┐┌──┐┌──┐┌──┐   │ │ (bar: NCs per       │    │
│ │ │Sg││Dc││NP││Rp│   │ │  case worker)       │    │
│ │ │4 ││1 ││2 ││5 │   │ │                     │    │
│ │ └──┘└──┘└──┘└──┘   │ │                     │    │
│ │ (stacked bar of     │ └─────────────────────┘    │
│ │  4 boolean fields)  │                            │
│ └─────────────────────┘                            │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Reoccurrence Rate   │ │ Registration by     │    │
│ │ (gauge: % reoccur)  │ │ Person (pie)        │    │
│ └─────────────────────┘ └─────────────────────┘    │
│                                                     │
│ [Filters: Classification | Status | Case Worker |   │
│  Reoccurrence | Corrective Action Type]             │
│ ┌───────────────────────────────────────────────┐   │
│ │ NC Table (expandable)                         │   │
│ │ ID | Title | Class | Worker | Reoccur | Days  │   │
│ │ ▶ NC-42 | Control batch... | Low | Anna | NO │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Single NC Case View (Level 2 — the richest detail view):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back to 2025-Q4    NC-42                          │
│─────────────────────────────────────────────────────│
│ Title: The control batch was not tested for GC-HPLC │
│ Classification: Low Risk                            │
│ Case Worker: Anna Huk  |  Registered By: Elias V.  │
│ Registered: 13/01/2022  |  Completed: 28/02/2022   │
│ Time to Close: 46 days  |  Reoccurrence: NO         │
│─────────────────────────────────────────────────────│
│                                                     │
│ [Classification Justification]                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ (formatted text — why this risk level)        │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Impact Assessment]                                 │
│ ┌───────────────────────────────────────────────┐   │
│ │ (formatted text block)                        │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Investigation Summary]                             │
│ ┌───────────────────────────────────────────────┐   │
│ │ (formatted text — findings)                   │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Root Cause Description]                            │
│ ┌───────────────────────────────────────────────┐   │
│ │ (formatted text — root cause)                 │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Corrective Actions Taken]                          │
│ ┌───────────────────────────────────────────────┐   │
│ │ ☑ Segregation of product                      │   │
│ │ ☐ Discarded product                           │   │
│ │ ☑ Started new production                      │   │
│ │ ☐ Repeated operation/analysis                 │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Impact Other]                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ NA                                            │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Linked CAPAs]  ← if any CAPA references this NC   │
│ • CAPA-073: "Updated according to CAPA073..."       │
└─────────────────────────────────────────────────────┘
```

**Why this design for NC:**
- 10 new fields make NC the data-richest domain — the case view needs structured sections, not a table
- Investigation → Root Cause → Impact → Corrective Actions is a natural **investigation narrative** that should read like a case report
- The 4 corrective action booleans are perfect as visual checkboxes — instant pattern recognition
- Corrective action aggregate chart across the quarter shows systemic patterns (e.g., "we're always segregating product but never discarding — why?")
- Classification justification explains the risk rating, preventing constant back-and-forth questions

---

### 5. Training Dashboard

**Clickable elements on main dashboard:**
- Stacked bar: Training by Trainee → **Sheet**
- Pie chart: Training Categories → **Sheet**
- Table rows → **Sheet** (single training deep view)

**Trainee Sheet (Level 1):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back    Training: Lisa Lovén    [Export CSV]      │
│─────────────────────────────────────────────────────│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ Total  │ │Complete│ │Overdue │ │Approved│        │
│ │   8    │ │   6    │ │   1    │ │   5    │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                     │
│ [Insight Panel - Training Specific]                 │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Deadline vs Actual  │ │ Category Breakdown  │    │
│ │ (scatter: on-time   │ │ (donut: categories) │    │
│ │  vs late vs pending)│ │                     │    │
│ └─────────────────────┘ └─────────────────────┘    │
│ ┌───────────────────────────────────────────────┐   │
│ │ Approval Pipeline                             │   │
│ │ [Pending ██████] [Completed ████] [Approved █]│   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Filters: Status | Category | Approval]             │
│ ┌───────────────────────────────────────────────┐   │
│ │ Training Table                                │   │
│ │ Title | Category | Deadline | Completed | Appr│   │
│ │ ▶ Working in MST | Gen lab | 01/02/24 | 12/02│   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Category Sheet (Level 1 — from pie click):**
- All trainings in this category
- Completion rate within category (how well is this category being completed?)
- Trainee distribution (who is assigned this category?)
- Overdue items highlighted
- Approval status breakdown

**Why this design for Training:**
- Deadline vs Actual scatter answers "are people finishing early, on time, or late?"
- Approval pipeline shows the new workflow stage (completed ≠ approved)
- Per-trainee view makes sense because training is inherently person-centric
- Category drill-down answers "which training types are falling behind?"

---

### 6. Documents in Flow Dashboard — Fully Reimagined

**Clickable elements on main dashboard:**
- Pie chart: Revision Type → **Sheet**
- Bar chart: Current Status → **Sheet**
- NEW chart: Documents by Author → **Sheet**
- NEW chart: Distribution by Team → **Sheet**
- NEW KPI cards: Total in flow, Periodic review required, Authorized copies, Avg days in flow
- Table rows → **Sheet** (single document deep view)

**Author Sheet (Level 1):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back    Documents: Yngve Ness    [Export CSV]     │
│─────────────────────────────────────────────────────│
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │In Flow │ │Avg Days│ │Auth.Cp │ │Rev.Req │        │
│ │   7    │ │  12d   │ │   2    │ │   3    │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                     │
│ [Insight Panel - Document Specific]                 │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Revision Types      │ │ Pending Steps       │    │
│ │ (donut: major/minor)│ │ (bar: by step type) │    │
│ └─────────────────────┘ └─────────────────────┘    │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Document Aging      │ │ Distribution Teams  │    │
│ │ (bar: days in flow) │ │ (badges/chips)      │    │
│ └─────────────────────┘ └─────────────────────┘    │
│                                                     │
│ [Filters: Revision Type | Status | Periodic Rev |   │
│  Authorized Copy | Responsible (approver)]          │
│ ┌───────────────────────────────────────────────┐   │
│ │ Doc Table                                     │   │
│ │ Doc# | Title | Ver | Type | Status | Age      │   │
│ │ ▶ DOC-0001 | Thawing... | 5.0 | Major | 12d │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Single Document Deep View (Level 2):**
```
┌─────────────────────────────────────────────────────┐
│ ← Back to Yngve Ness    DOC-0001_0003.1             │
│─────────────────────────────────────────────────────│
│ Title: Thawing and expansion of cells               │
│ Version: 5.0  |  Revision: Major Version Change     │
│ Author: Yngve Ness  |  Responsible: Head of Ops     │
│ Version Date: 10/09/2025                            │
│ Current Status: (completed)                         │
│─────────────────────────────────────────────────────│
│                                                     │
│ [Change Reason]                                     │
│ ┌───────────────────────────────────────────────┐   │
│ │ CAPA281: Added field for signature of process │   │
│ │ performed                                     │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Compliance]                                        │
│ ┌───────────────────────────────────────────────┐   │
│ │ Authorized Copy: No                           │   │
│ │ Periodic Review: Not required                 │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Distribution]                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ Production Team                               │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ [Linked Items]  ← parsed from Change Reason         │
│ • CAPA-281: "Repair of alarm sound in DIA025"       │
│   → Click to view CAPA detail                       │
└─────────────────────────────────────────────────────┘
```

**Distribution Team Sheet (Level 1 — new chart):**
- All documents distributed to this team
- Revision type breakdown within team
- Aging analysis: how long team's documents sit in flow
- Periodic review compliance: how many of this team's docs require review?

**Why this design for Documents:**
- Author and Responsible are now distinct roles (writer vs approver) — both need visibility
- Change Reason is the richest field: it tells *why* the document is changing and links to CAPAs/CMIDs
- Periodic Review and Authorized Copy are compliance fields — surface them as KPI cards for QA oversight
- Distribution List enables team-level document workload analysis (which teams have the most document activity?)
- Document aging (days since Version Date with no Completed On) highlights stale items
- Version number enables tracking document maturity

---

### 7. Compendium Dashboard — Drill-Through Hub

**Clickable elements (all new):**
- Overdue bar chart: each bar → **Sheet** pre-filtered to overdue items for that domain
- NC Risk & Volume bars → same drill-down as NC dashboard
- NC Reoccurrence line → same drill-down as NC dashboard
- Documents in Flow summary cards → Documents drill-down
- Bi-weekly delta values → **Dialog** showing what changed

**Overdue Drill-Through (Level 1):**
Clicking "CAPA (Exec): 3" opens a Sheet with the CAPA framework, pre-filtered to show only overdue execution-phase CAPAs. Same pattern for each domain bar.

**Why this design for Compendium:**
- It's the executive overview — every number should be explorable
- Reuses the drill-down components from individual dashboards (no duplication)
- Delta values need explainability: "+2 since last period" → which 2 items?

---

## Shared Framework Components

All drill-downs share:
1. **DrillDownSheet** — Sheet container with breadcrumb navigation, back button, export
2. **DrillDownDialog** — Dialog container for lighter views
3. **SummaryBar** — Row of KPI mini-cards (configurable metrics)
4. **InsightPanel** — Configurable grid of sub-charts (each dashboard provides its own)
5. **FilterBar** — Inline filters within drill-down (select, multi-select, search, toggle)
6. **ExpandableDataTable** — Enhanced DataTable with expandable rows and row-click navigation
7. **DetailSection** — Formatted text block for narrative fields (NC investigation, CAPA description, etc.)
8. **CompareMode** — Side-by-side comparison of 2+ selected items
9. **CrossLink** — Clickable reference to item in another domain (CAPA → Document, Document → CMID)

---

## Completed Steps

1. Codebase exploration — full analysis of all 7 dashboards, charts, click handlers, data types
2. Clarifying questions — resolved 4 design decisions (container type, interactivity, consistency, navigation)
3. New data analysis — 31 new fields + 1 rename, including 6 new Document KPI fields
4. Per-dashboard drill-down design — purpose-built visualizations for each domain
5. Design spec written and approved — `docs/2026-03-27-drill-down-system-design.md`
6. Implementation plan written — 25 tasks, 4 phases — `docs/superpowers/plans/2026-03-27-drill-down-system.md`
7. Self-review completed — gaps fixed inline, remaining gaps in appendix

## Next Step: Execute the Plan

Run the implementation plan at `docs/superpowers/plans/2026-03-27-drill-down-system.md` using either:
- `superpowers:subagent-driven-development` (recommended)
- `superpowers:executing-plans`

No tasks started yet. Begin with **Phase 1, Task 1** (update shared types).
