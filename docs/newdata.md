# New Data Fields — Parser & Type Updates

This document describes all new and changed columns across the six CSV/TSV file types, and what needs to be updated in the codebase to accommodate them.

## Parser (`src/components/multi-uploader.tsx`)

The CSV parser itself does **not** need structural changes — it dynamically reads headers and maps them to key-value pairs. However, the **type definitions** and **dashboard components** that consume the parsed data must be updated to include the new fields.

One exception: **Batch Release** requires post-parse deduplication logic for dual batch number columns.

---

## File-by-File Changes

### 1. Batch Release KPI

**Type location:** Inline interface in `src/components/batch-release-dashboard.tsx`

#### New columns

| Column | Type | Example values | Notes |
|--------|------|----------------|-------|
| `Project Number` | `string` | `"2023-50"`, `"2023-51"` | Project identifier |
| `Product number` | `string` | `"8 820"`, `"3 226"` | May contain spaces |
| `Product Name` | `string` | `"Anti-Calprotectin"`, `"CD3 PECy5"` | Human-readable product name |
| `Batch number from list` | `string` | Often empty; contains replacement batch number when present | See dedup logic below |

#### Batch number deduplication

The eQMS now exports two batch number columns:

- **`Batch number`** — the original/legacy batch identifier
- **`Batch number from list`** — the replacement identifier from the updated eQMS

Both columns exist for historical continuity, but they refer to the same batch. When both have values for a given row, the batch must only be counted once in all metrics and aggregations.

**Implementation approach:**
- Add a computed/canonical field (e.g. `canonicalBatchNumber`) that resolves to `Batch number from list` when non-empty, otherwise falls back to `Batch number`.
- Use this canonical value for all grouping, counting, and deduplication in the dashboard.
- Both raw columns should still be accessible for display/drill-down so historical traceability is preserved.

#### Updated interface

```ts
interface BatchReleaseData {
  'Batch number': string;
  'Batch number from list'?: string;   // NEW
  'Project Number'?: string;            // NEW
  'Product number'?: string;            // NEW
  'Product Name'?: string;              // NEW
  'Final batch status': string;
  'Clone name': string;
  'High-risk nonconformance': string;
  'Low-risk nonconformances': string;
  'Type of Production': string;
  'Company': string;
  'Company aliases': string;
  'Completed On': string;
  canonicalBatchNumber?: string;        // COMPUTED
  [key: string]: any;
}
```

---

### 2. CAPA

**Type location:** `CapaData` in `src/lib/types.ts`

#### New columns

| Column | Type | Example values | Notes |
|--------|------|----------------|-------|
| `Category of Corrective Action` | `string` | `"Equipment / premises"`, `"System /process"` | Categorization of the CAPA |
| `Priority` | `string` | `"Low"`, `"Normal"`, `"High"` | Priority level |
| `Action taken` | `string` | `"Action performed"` | Often empty until action is taken |
| `Expected results of Action` | `string` | Free text | Describes success criteria |
| `Action plan` | `string` | Free text | Describes planned corrective steps |
| `Description` | `string` | Free text | CAPA description/context |
| `Proposed responsible` | `string` | Person name | Often empty |

#### Updated interface

```ts
export interface CapaData {
  'CAPA ID': string;
  'Title': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
  'Completed On'?: string;
  'Category of Corrective Action'?: string;   // NEW
  'Priority'?: string;                         // NEW
  'Action taken'?: string;                     // NEW
  'Expected results of Action'?: string;       // NEW
  'Action plan'?: string;                      // NEW
  'Description'?: string;                      // NEW
  'Proposed responsible'?: string;             // NEW
  isOverdue?: boolean;
  effectiveDueDate?: Date;
}
```

---

### 3. Change Action

**Type location:** Inline interface in `src/components/change-action-dashboard.tsx`

#### New columns

| Column | Type | Example values | Notes |
|--------|------|----------------|-------|
| `Approve` | `string` | `"Approved"` | Approval status of the action |
| `Completed On` | `string` | `"09/03/2026 02:58 PM"` | Datetime; empty when not yet completed |

#### Updated interface

```ts
interface ChangeActionData {
  'Change_ActionID': string;
  'Action required prior to change': string;
  'Responsible': string;
  'Pending Steps': string;
  'Deadline': string;
  'Change Title': string;
  'Change ID (CMID)': string;
  'Approve'?: string;            // NEW
  'Registration Time': string;
  'Completed On'?: string;       // NEW
  isOverdue: boolean;
  deadlineDate: Date;
  registrationDate: Date;
  [key: string]: any;
}
```

---

### 4. Document KPI

**Type location:** `DocumentKpiData` in `src/lib/types.ts`

#### Renamed column

| Old column | New column | Notes |
|------------|------------|-------|
| `Responsible` | `Author` | Column has been renamed in the eQMS export — the old `Responsible` field is now `Author` (the document writer). A **new** `Responsible` column exists as the approver/owner role. |

This is a breaking change — every reference to `Responsible` in the `DocumentKpiData` interface and in `src/components/documents-in-flow-dashboard.tsx` must be updated to `Author`.

#### New columns

| Column | Type | Example values | Notes |
|--------|------|----------------|-------|
| `Version` | `string` | `"5.0"`, `"3.0"` | Document version number |
| `Change Reason` | `string` | `"CAPA281: Added field for signature..."`, `"CMID15: Change of company name..."` | Free text explaining why document was changed. Often references CAPAs and CMIDs — enables cross-domain linking. |
| `Responsible` | `string` | `"Head of Operations"`, `"Head of Quality"` | Approver/owner role — distinct from Author. Often empty (~317/442 rows). |
| `Authorized copy` | `string` | `"Yes"`, `"No"` | Whether the document is an authorized copy (Yes: 131, No: 275) |
| `Periodic review of document` | `string` | `"Required"`, `"Not required"` | Whether periodic review is required (Required: 110, Not required: 288) |
| `Distribution List` | `string` | `"Production Team"`, `"1-Diatec ISO"`, `"Business Development, Production Team"` | Team(s) receiving the document. Comma-separated when multiple. 40+ distinct values. |

#### Updated interface

```ts
export interface DocumentKpiData {
  'Doc Prefix': string;
  'Doc Number': string;
  'Title': string;
  'Version Date': string;
  'Document Flow': string;
  'Pending Steps': string;
  'Completed On': string;
  'Author': string;                          // RENAMED from old 'Responsible'
  'Version'?: string;                        // NEW
  'Change Reason'?: string;                  // NEW — references CAPAs/CMIDs
  'Responsible'?: string;                    // NEW — approver role (distinct from Author)
  'Authorized copy'?: string;               // NEW — Yes/No
  'Periodic review of document'?: string;   // NEW — Required/Not required
  'Distribution List'?: string;             // NEW — comma-separated team names
}
```

---

### 5. Non-Conformance

**Type location:** Inline interface in `src/components/non-conformance-dashboard.tsx`

#### New columns

| Column | Type | Example values | Notes |
|--------|------|----------------|-------|
| `Completed On` | `string` | `"28/02/2022 12:41 PM"` | Datetime of NC closure |
| `Impact Other` | `string` | `"NA"`, free text | Impact description |
| `Investigation summary` | `string` | Free text | Summary of investigation findings |
| `Impact Assessment` | `string` | Free text | Formal impact assessment |
| `Root cause description` | `string` | Free text | Root cause analysis |
| `Classification justification` | `string` | Free text | Justification for risk classification |
| `Segregation of product` | `string` | Empty or value | Whether product was segregated |
| `Discarded product` | `string` | Empty or value | Whether product was discarded |
| `Started new production` | `string` | Empty or `"True"` | Whether new production was started |
| `Repeated operation/analysis` | `string` | Empty or `"True"` | Whether operation/analysis was repeated |

The last four columns (`Segregation of product`, `Discarded product`, `Started new production`, `Repeated operation/analysis`) represent corrective actions taken. They behave as booleans — presence of a value (e.g. `"True"`) means yes, empty means no.

#### Updated interface

```ts
interface NonConformanceData {
  'Id': string;
  'Non Conformance Title': string;
  'Classification': 'Low risk' | 'High risk' | string;
  'Pending Steps': string;
  'Case Worker': string;
  'Status': string;
  'Registration Time': string;
  'Registered By': string;
  'Reoccurrence': 'YES' | 'NO' | string;
  'Completed On'?: string;                    // NEW
  'Impact Other'?: string;                     // NEW
  'Investigation summary'?: string;            // NEW
  'Impact Assessment'?: string;                // NEW
  'Root cause description'?: string;           // NEW
  'Classification justification'?: string;     // NEW
  'Segregation of product'?: string;           // NEW — boolean-ish
  'Discarded product'?: string;                // NEW — boolean-ish
  'Started new production'?: string;           // NEW — boolean-ish
  'Repeated operation/analysis'?: string;      // NEW — boolean-ish
  registrationDate: Date;
  [key: string]: any;
}
```

---

### 6. Training KPI

**Type location:** Inline interface in `src/components/training-dashboard.tsx`

#### New columns

| Column | Type | Example values | Notes |
|--------|------|----------------|-------|
| `Final training approval` | `string` | Approval status | Often empty until approved |
| `Completed On` | `string` | `"12/02/2024 10:24 AM"` | Datetime of training completion |

#### Updated interface

```ts
interface TrainingData {
  'Record training ID': string;
  'Title': string;
  'Trainee': string;
  'Training category': string;
  'Deadline for completing training': string;
  'Final training approval'?: string;   // NEW
  'Pending Steps': string;
  'Completed On'?: string;              // NEW
  [key: string]: any;
}
```

---

## Summary of Changes

| File type | New columns | Renamed columns | Special logic |
|-----------|-------------|-----------------|---------------|
| Batch Release | 4 | 0 | Batch number deduplication |
| CAPA | 7 | 0 | — |
| Change Action | 2 | 0 | — |
| Document KPI | 6 | 1 (`Responsible` → `Author`) | Rename old references; new `Responsible` is approver role; `Change Reason` enables cross-domain linking to CAPAs/CMIDs |
| Non-Conformance | 10 | 0 | — |
| Training | 2 | 0 | — |
| **Total** | **31** | **1** | |

## Files to modify

1. `src/lib/types.ts` — Update `CapaData` and `DocumentKpiData` interfaces
2. `src/components/batch-release-dashboard.tsx` — Update inline interface, add dedup logic
3. `src/components/change-action-dashboard.tsx` — Update inline interface
4. `src/components/non-conformance-dashboard.tsx` — Update inline interface
5. `src/components/training-dashboard.tsx` — Update inline interface
6. `src/components/documents-in-flow-dashboard.tsx` — Rename `Responsible` → `Author` in all usages
