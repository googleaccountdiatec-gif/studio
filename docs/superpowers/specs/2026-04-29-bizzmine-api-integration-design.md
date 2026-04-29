# BizzMine API Integration — Design Spec (v2)

**Date:** 2026-04-29
**Status:** DRAFT — incorporating user feedback round 1
**Author:** Claude (with Joakim Sørgård)

## 1. Goal

Replace manual CSV uploads with direct authenticated calls to the BizzMine Public REST API. Use the richer data the API exposes to:

- Eliminate point-in-time snapshots in favor of **deriving any historical view from raw timestamps** (the dataset is its own time-machine)
- Surface previously-invisible data (Batch Registry, workflow timelines, live task assignments)
- Resolve user names automatically by harvesting them from the data
- Provide a single manual "Sync Now" entry point with a last-synced indicator

## 2. Verified findings (2026-04-29 probes)

### 2.1 Access — all 9 collections accessible with the temporary key

| Collection | Code | Records | datadesign | instances size |
|---|---|---|---|---|
| CAPA | `CAPA` | 264 | 200 OK | 2.2 MB |
| Non-conformance | `NC` | (large) | 200 OK | 15.8 MB |
| Change Actions | `Change_Actions` | (large) | 200 OK | 3.6 MB |
| Changes | `CM` | (large) | 200 OK | 2.0 MB |
| Batch Release KPI | `KPI_batch_release` | 189 | 200 OK | 1.7 MB |
| **Batch Registry (NEW)** | `BR` | 83 | 200 OK | 178 KB |
| Documents | `DC` | (large) | 200 OK | 4.3 MB |
| Training | `A004` | (large) | 200 OK | 3.0 MB |
| Intro Training | `A007` | (large) | 200 OK | 1.1 MB |

**No permission gaps. The key has full read access to every collection in scope.**

### 2.2 Field-shape conventions across all collections

Confirmed by probing CAPA, BR, KPI_batch_release:

| Field type (BookmarkName) | Raw shape | Normalized output |
|---|---|---|
| `*_*ID*` (AlphaNumeric) | `"B8794"` | string passthrough |
| `*ID` (Numeric) | `1.0` | integer |
| `*Time` (DateTimePicker) | `"1/4/2024 5:02:20 PM +00:00"` | ISO 8601 string |
| `*Date` (DatePicker) | `"3/31/2022 12:00:00 AM +00:00"` | ISO 8601 date string |
| `Combobox` / `RadioGroup` | `{value: 64, text: "Normal"}` | `"Normal"` (drop the code) |
| `OrganizationChartUnitSelector` | `[{type:1\|2, id:N, value:"Anna Huk"}]` | comma-joined `value` strings |
| `Memo` | `"<div>html</div>"` | strip tags for tables, keep raw for detail |
| `Status` (EnumList) | `3` | look up via shared status map |
| `PendingSteps` | `"CAPA Execution"` | string passthrough |
| Sub-collections (GridRecord) | `[{CrossLinkInstancesID, ...children}]` | flatten, normalize children recursively |

### 2.3 Critical finding — sub-collections embedded inline

A CAPA record's response carries its linked records nested:

```json
{
  "CAPA_Tittle": "...",
  "NonConformances": [{ "NonConformances_NC_Title": "...", ... }],
  "Incidents": [...],
  "Document": [...],
  "Attachments": [...]
}
```

**No second call needed for cross-references.** This replaces today's lossy regex-based `parseCrossReferences()` with exact, typed links.

### 2.4 User-name resolution — confirmed strategy

Probed `/task/23144/executors` (a closed task on CAPA Resolve step):

```json
[{ "UsersID": 14, "CompletedOn": "2022-11-30T15:38:05.2395774+00:00" }]
```

**Executors API returns IDs only, no names** — confirms the docs.

But every collection's instance response includes OrganizationChartUnitSelector fields where names ARE embedded:

```
CAPA_AssignedTo            = [{type:1, id:84, value:"Christer Fjeld"}]
CAPA_RegisteredBy          = [{type:1, id:12, value:"Johanna Lindskog Frydendal"}]
CAPA_RegisteredOnBehalfOf  = [{type:1, id:14, value:"Anna Huk"}]
KPI_batch_release_RegisteredBy = [{type:1, id:14, value:"Anna Huk"}]
BR_RegisteredBy            = [{type:1, id:15, value:"Øyvind Røe"}]
```

Open tasks (`/collection/{code}/tasks`) also include names in `Assignees[].Name`.

**Strategy: build a tenant-wide `usersById` map at sync time** by walking every instance in every collection and harvesting `{id → value}` pairs from every OrganizationChartUnitSelector field. Group IDs (`type: 2`) get harvested too. Persist the map in Firestore so it accumulates across syncs (catches users who touched records years ago even if they never appear in fresh data).

Coverage estimate: any user who has ever Registered, Assigned, or Approved anything — i.e., anyone who has touched the system — will have `id → name` resolved. The only blind spot is a user who exclusively COMPLETED tasks but never appeared as an assignee/registrar — in practice, vanishingly rare in BizzMine because workflows always assign before they complete.

### 2.5 BR collection — Upstream/Downstream + pooling

`BR_Typeofbatch` enum values:

| ID | Label | Class |
|---|---|---|
| 1466 | Upstream production | **Upstream** |
| 1473 | FPLC and Final Batch | Downstream |
| 1463 | Final Batch | Downstream |
| 1465 | Revialling/Reprocessing | Downstream |
| 1464 | FPLC | Downstream |

**Definition: "Downstream batch" = `BR_Typeofbatch.value != 1466`.**

`BR_Refpreviousbatch` (GridRecord sub-collection) lists the upstream batches that fed into this batch — exactly the pooling structure the user described. Tree-rendering this is straightforward.

### 2.6 BR ↔ KPI_batch_release cross-link — confirmed

| Side | Field | Format | Sample |
|---|---|---|---|
| BR | `BR_Batchnumber` | AlphaNumeric | `B9441` |
| KPI_batch_release | `KPI_batch_release_Batchnumber` | AlphaNumeric | `B8794` |
| KPI_batch_release | `InvolvedBatches[].InvolvedBatches_Batchnumber` | AlphaNumeric (sub-collection) | various |

Same string format. **A BR record is "released" if its `Batchnumber` appears either as `KPI_batch_release_Batchnumber` directly OR in any KPI_batch_release record's `InvolvedBatches` sub-collection.** Otherwise it's "not yet released."

## 3. The single biggest architectural shift — snapshot-free

### 3.1 What the app does today

`compendium-dashboard.tsx` saves a `MetricSnapshot` to `biweekly_snapshots` Firestore collection: a tiny dict like `{nonConformance: 47, capaExecution: 12, ...}` with a timestamp. The "2-week trend" compares today's count vs. a snapshot from ~14 days ago. Snapshots are manually triggered via a "Save Snapshot" button.

**Limitations:** snapshots are sparse (only saved when someone clicks), counts only (no record-level detail), and trends collapse if anyone forgets to click.

### 3.2 What the API enables

Every record carries:
- `RegistrationTime` — immutable creation timestamp
- `CompletedOn` — set once when the workflow ends, never changes
- `Pending Steps` — current state
- (per-step, via `/instance/{vid}/step/{sid}/executors`) — when each step was completed

**The dataset is its own time-machine.** Any "what was the state on date X" question is answerable from current data alone:

| Question | Computation against current dataset |
|---|---|
| Was record R overdue at date X? | `deadline < X AND (CompletedOn empty OR CompletedOn > X)` |
| What records closed in [X-14d, X]? | `X-14d ≤ CompletedOn ≤ X` |
| What records were created in [X-14d, X]? | `X-14d ≤ RegistrationTime ≤ X` |
| What was the overdue count at date X? | apply the overdue check to all records with reference date X |
| What records moved from step A to step B in [Y, Z]? | per-record executors call (cacheable) |

Crucially, the first four questions need ZERO extra API calls — the answer is in the current dataset.

### 3.3 Implications

- **`biweekly_snapshots` becomes redundant for new writes.** Existing snapshots remain in Firestore as historical reference (no migration needed). Stop writing new ones.
- The "2-week trend" becomes a **live computation with arbitrary reference date selection** — pick any date, the dashboard recomputes.
- New control: a date picker on Total Overview ("Compare to: 2 weeks ago | 1 month ago | Custom date").
- The "Save Snapshot" button is removed. The "History" panel becomes a **time-travel slider** instead.
- Cycle-time analytics (`CompletedOn - RegistrationTime` distributions) drop out for free.

### 3.4 Migration path

- Phase 1: feature-flag a `useSnapshotFreeMode: boolean`. When `true`, all dashboards compute trends from the live dataset.
- Phase 2: validate against existing snapshots — for every saved snapshot, recompute the same metrics from the live dataset using that snapshot's date as the reference. Counts should match within rounding (some records may have been deleted, so allow small drift).
- Phase 3: flip the default to `true`, retire the "Save Snapshot" button, retain the Firestore data as read-only history.

## 4. Architecture

### 4.1 Module layout

```
src/
  app/
    api/
      bizzmine/
        sync/
          route.ts                    # POST: sync all collections at once
        collection/[code]/
          route.ts                    # GET one collection's normalized records
        timeline/[code]/[versionsId]/
          route.ts                    # GET per-record step history (Phase 4)
        tasks/[code]/
          route.ts                    # GET open tasks (Phase 4)
        users/
          route.ts                    # GET harvested user lookup map
        health/
          route.ts                    # GET API connectivity check
  lib/
    bizzmine/
      client.ts                       # server-only fetch wrapper, X-Token + X-Tenant
      config.ts                       # base URL, tenant, all collection codes
      normalize/
        index.ts                      # generic field-type normalizers
        capa.ts                       # CAPA BookmarkName → CSV-header map
        nc.ts                         # NC mapping (67 fields)
        change-actions.ts
        changes.ts                    # CM
        batch-release.ts              # KPI_batch_release
        batch-registry.ts             # NEW: BR
        documents.ts                  # DC
        training.ts                   # A004 + A007 merged
      users.ts                        # harvest user-id → name from inst data
      time-travel.ts                  # historical-state computations (overdue at X, etc.)
      schemas/                        # checked-in datadesign snapshots for drift detection
        capa.snapshot.json
        nc.snapshot.json
        ...
      types.ts                        # raw API + normalized output types
  contexts/
    data-context.tsx                  # extended with sync(), lastSyncedAt
  components/
    sync-now-button.tsx               # NEW: "Sync from BizzMine" with timestamp
    batch-registry-view.tsx           # NEW: downstream-not-released view
    workflow-timeline.tsx             # NEW: per-record step history
```

### 4.2 Data flow

```
[Total Overview] "Sync Now" button
   ↓ POST /api/bizzmine/sync
[Server] BizzmineClient.fetchAll()
   - parallel GETs to /collection/{code}/instances for all 9 codes
   - normalize each per its mapper
   - harvest users from OrganizationChartUnitSelector fields
   - return { collections: {...}, users: {...}, syncedAt: <iso> }
   ↓
[DataContext]
   setCapaData(...), setNcData(...), ..., setLastSyncedAt(...), setUsers(...)
   ↓
[Existing dashboards render against the same shape they consume today]
```

The normalization layer's contract: **output JSON whose field names match today's CSV headers**, so dashboards work unchanged in Phase 1. Sub-collections are passed through under their CollectionsCode key (e.g., `record.NonConformances = [...]`) — new code can use them; old code ignores them.

### 4.3 Caching policy (per user decision: manual sync only)

- **No background polling, no automatic refresh, no request-time caching.**
- The full sync result is held in `DataContext` (in-memory) for the session.
- A `lastSyncedAt` timestamp displays next to the Sync Now button: "Last synced: 12 minutes ago" (auto-updating relative time).
- An optional **client-side IndexedDB cache** (using `idb-keyval` or similar) lets the dashboard render last-known data on cold app load while the user clicks Sync. Removes the "blank dashboard for 5 seconds" UX. Cache is stamped with the source sync timestamp.
- Server route does not cache between requests — each Sync Now hits BizzMine fresh.

## 5. Phased rollout

### Phase 1 — Foundation (1–2 days)

- Add `BIZZMINE_API_BASE`, `BIZZMINE_TENANT` (plain env), `BIZZMINE_TOKEN` (Firebase Secret Manager) to `apphosting.yaml` with `availability: [RUNTIME]` only
- Create `src/lib/bizzmine/client.ts` with `import "server-only"` guard
- Create generic normalizers (combobox unwrap, OrgChart flatten, HTML strip, date passthrough)
- Create `src/lib/bizzmine/users.ts` user-harvest module
- Add `/api/bizzmine/health` route — returns `Version` from `/AD/info`
- Add Settings panel: "BizzMine connection status" with last-synced timestamp and a "Test Connection" button
- **Deliverable:** clicking "Test Connection" returns `Version: 6.0.44.5` from the live API

### Phase 2 — CAPA pilot (2–3 days)

- Write `normalize/capa.ts` — produces JSON matching today's CSV-export shape
- Add `/api/bizzmine/collection/CAPA/route.ts`
- Add a "Sync Now" button in the Total Overview header (placeholder; only CAPA wired)
- Add `lastSyncedAt: Date | null` to `DataContext`
- Validation: side-by-side debug page that loads CAPA via API and via current CSV upload; diffs record counts and key fields; logs discrepancies
- **Deliverable:** CAPA tab renders identically whether sourced from CSV or API; fields like `Title`, `Due Date`, `Assigned To` show the same values

### Phase 3 — Remaining collections in parallel (3–5 days)

- `normalize/nc.ts` (67 fields, biggest mapping job — sub-collections matter for cross-refs)
- `normalize/change-actions.ts`
- `normalize/changes.ts` (CM)
- `normalize/batch-release.ts` (KPI_batch_release with its 139 fields — most have current dashboard analogs)
- `normalize/documents.ts` (DC)
- `normalize/training.ts` — **merges A004 + A007 streams into one shape with a `category: "regular" | "introduction"` field** (per user decision: fold A007 into existing Training tab)
- `normalize/batch-registry.ts` — new shape, new collection
- One unified `/api/bizzmine/sync` route that fans out parallel fetches with concurrency cap (e.g. `Promise.all` with 3-at-a-time semaphore to be polite to BizzMine)
- Per-collection progress indicator on the Sync Now button ("Syncing 4/9...")
- **Deliverable:** every existing tab works against API data

### Phase 4 — New capabilities

#### 4.1 Snapshot-free time-travel mode (replaces `biweekly_snapshots`)

- Implement `time-travel.ts`: `getStateAt(record, referenceDate)` returns `{isOverdue, isCompleted, isPending}` computed from current data + reference date
- Replace Compendium's "snapshot dropdown" with a **date picker**: "Compare current state to: [2 weeks ago] [1 month ago] [Custom date ▾]"
- Dashboard now shows arrows / deltas computed live for any chosen reference
- Hide (don't delete) the "Save Snapshot" button behind a feature flag for the first 2 weeks; remove after validation
- Add `closedInWindow(records, [start, end])`, `createdInWindow(records, [start, end])` helpers used across all dashboards
- **Deliverable:** Compendium trend chart works for ANY user-chosen historical comparison date, not just the saved snapshots

#### 4.2 Batch Registry tab as downstream-not-released view

Per user decision: focus the BR experience on what was previously invisible.

- New tab "Batch Registry" between "Batch Release" and "CAPA"
- **Headline view:** list of downstream batches NOT yet released
  - Filter: `BR_Typeofbatch.value != 1466 (Upstream production)`
  - Filter: `BR_Batchnumber NOT IN { all KPI_batch_release_Batchnumber + all InvolvedBatches.Batchnumber }`
  - Columns: Batch number, Type (FPLC / Final / Revialling / FPLC+Final), Project, Days since registration, Pending steps
  - Sort by oldest first ("most aging un-released")
- **Pooling visualization:** when a row is expanded or clicked, show its `Refpreviousbatch` GridRecord as a tree:
  ```
  B9441 [Final Batch]
   ├─ B9300 [FPLC]      (registered 2026-03-15)
   ├─ B9301 [FPLC]      (registered 2026-03-15)
   └─ B9298 [Upstream]  (registered 2026-03-10)
  ```
- Cross-link from any KPI_batch_release record's drill-down → the BR tree of involved batches
- Secondary filters (collapsed by default): All batches, Released only, By type, By project
- **Deliverable:** anyone can answer "what's stuck in production but not yet released" in under 5 seconds

#### 4.3 User-name harvesting

- `users.ts` walks every record in every collection on sync, harvests `id → name` pairs
- Persist to a single Firestore document `bizzmine_meta/users` with `{[id]: { name, type, lastSeenAt, sourceCollections: [...] }}`
- Hydrate on every sync (overwrite stale names, accumulate new ones)
- Apply lookup wherever historical data has `UsersID` only (executors timeline, reassignment heuristic)
- Display "User #14 (unresolved)" only as a fallback — should be vanishingly rare
- **Deliverable:** every executor row shows a real name in the timeline view

#### 4.4 Workflow timeline drill-down

- For any record in any tab, the existing DrillDownSheet gets a "Timeline" tab
- Server route `/api/bizzmine/timeline/[code]/[versionsId]` calls `/instance/{vid}/step/{sid}/executors` for each step in the workflow
- Renders timeline: Registration → step → step → Closed, with names + timestamps + days-between
- Caches per-record timelines in IndexedDB (immutable once a record is closed)
- **Deliverable:** click any NC, see exactly when every step happened, who did it, how long each took

#### 4.5 Live "Open Tasks" page

- New top-level tab or sidebar drawer: "Open Tasks"
- Calls `/collection/{code}/tasks` for each collection on Sync Now
- Combined view: collection, instance ID, step, due date, days-to-deadline, assignees (user OR group, from `Assignees[].Name`)
- Filters: my tasks (matches logged-in user, if available — otherwise selectable), production team, overdue only, due-this-week
- **Deliverable:** a single page that answers "what's everyone supposed to be doing right now and which deadlines are tight"

#### 4.6 Reassignment heuristic

- After sync, for each closed task in the recent N days, fetch `/task/{id}/executors`
- Flag tasks with ≥2 distinct `UsersID` (resolved via the user-name map)
- New panel on Total Overview: "Tasks reassigned in this period" with date filter
- **Deliverable:** visibility into informal forwarding without requiring BizzMine admin access

#### 4.7 Cross-reference enrichment

- Replace the regex-based `parseCrossReferences()` with traversal of inline sub-collections
- A CAPA record's drill-down panel lists its linked NCs/Incidents/Documents directly from the API response
- Bidirectional: an NC record carries `NonConformances ← CAPAs` (verify shape on probe)
- **Deliverable:** click any cross-link badge and land on an exact, typed target — no more lossy text matching

#### 4.8 Cycle-time analytics

- New section on Total Overview or its own tab
- For each completed record: `CompletedOn - RegistrationTime` distribution
- Per-step bottlenecks (median / P90 days a step holds tasks)
- Outliers (records that took >P95 cycle time, with link to drill-down)
- Trend over time: are cycles getting faster or slower?
- **Deliverable:** management can answer "are we getting more efficient in our QA process" with one chart

#### 4.9 BizzMine deep-link

- Each detail panel: "Open in BizzMine" button
- URL pattern: `https://diatec.bizzmine.cloud/...{instance route}`. Verify pattern with one manual click after Phase 2.
- **Deliverable:** seamless escalation path from dashboard → source-of-truth

#### 4.10 Schema-drift watchdog

- On every sync, fetch `/datadesign` for each collection
- Compare BookmarkNames against checked-in `src/lib/bizzmine/schemas/*.snapshot.json`
- On mismatch: yellow toast + Settings page warning ("BizzMine schema changed: 3 fields added in NC. Review normalizer mappings.")
- Don't block sync — degrade gracefully
- **Deliverable:** safety net for BizzMine version upgrades

### Phase 5 — CSV uploader handling

Per user decision: keep CSV uploader as fallback initially.

- Move it from the global header into Settings → "Manual data override (fallback)"
- Add a banner on dashboards loaded from CSV: "Currently showing CSV-uploaded data from $filename. [Sync from BizzMine] to refresh."
- After 1 month of stable API operation: remove the uploader and `parseCustomCSV` parser (~250 lines) entirely
- **My recommendation:** keep it temporarily, but actively gate it. Two data sources visible in the same UI is a "wait, why does this disagree" trap. Hiding the CSV path in Settings keeps it available for emergencies without polluting the daily flow.

## 6. Security

```yaml
# apphosting.yaml additions
env:
  - variable: BIZZMINE_API_BASE
    value: "https://diatec-api.bizzmine.cloud"
    availability: [RUNTIME]
  - variable: BIZZMINE_TENANT
    value: "diatec-live"
    availability: [RUNTIME]
  - variable: BIZZMINE_TOKEN
    secret: bizzmine-token         # Firebase Secret Manager
    availability: [RUNTIME]        # critical — never BUILD
```

- `src/lib/bizzmine/client.ts` starts with `import "server-only"` to make accidental browser imports a build error
- Never log full request URLs or the `X-Token` header — they may carry instance IDs that are themselves sensitive
- Per `APIBizzInstruction.md` §7.5: rotate keys on staff turnover; consider per-environment keys later
- Memo fields can carry PII — never include full record payloads in error reports; redact

## 7. Testing strategy

- **Side-by-side validation (Phase 2):** debug page loads CAPA from API and from a saved CSV, diffs record-by-record, logs discrepancies. Run for the first 2 weeks of Phase 2 to catch normalization bugs.
- **Snapshot-free validation (Phase 4.1):** for every existing `biweekly_snapshots` record, recompute that snapshot's metrics from the live dataset using the snapshot's timestamp as reference date. Counts should match within tolerance (small drift expected from deleted records).
- **Schema-snapshot tests:** unit tests assert `normalize.capa(fixtureFromApi)` produces expected CSV-shaped output. Fixtures saved in `tests/fixtures/bizzmine/` (gitignored if PII present, or sanitized).
- **Schema-drift watchdog:** on app boot, compare live `/datadesign` against checked-in snapshots; fail loud on rename, warn on additions.

## 8. Effort & risk

| Phase | Effort | Risk |
|---|---|---|
| 1 — Foundation | 1–2 days | Low |
| 2 — CAPA pilot | 2–3 days | Medium (normalization correctness) |
| 3 — Remaining collections | 3–5 days | Medium (NC has 67 fields + nested sub-collections) |
| 4 — Each new capability | 2–5 days each | Each gets its own follow-up spec |
| 5 — CSV phase-out | 0.5 day | Low |

**Phase 1–3 total: ~1.5 weeks** to feature-parity on live data. Phase 4 is the payoff and decomposes into 10 follow-up specs, prioritizable independently.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Undocumented rate limits | Concurrency cap (3 parallel) on sync; back off on 429; surface in error toast |
| BizzMine schema drift on upgrade | Schema-snapshot watchdog (4.10) |
| Memo fields carry PII into logs | Redaction in client wrapper; no full payloads in errors |
| Token leak via `.env` on OneDrive (called out in instruction file) | Token lives in Firebase Secret Manager only, never in `.env` |
| Cold-start latency on Cloud Run first sync | Acceptable for manual-sync UX; if painful later, set `minInstances: 1` (cost trade-off) |
| Single sync covers ~32 MB | Stream rather than buffer where possible; client receives normalized output (much smaller after stripping unused fields) |
| Accidentally exposing temp key in commits | `api/` is gitignored; verified with `git check-ignore` |

## 10. Out of scope (this spec)

- Writing back to BizzMine (advancing tasks, creating instances, file uploads) — possible via the same API but not requested. Designed read-only for safety.
- OIDC user login flow — not needed for the read-only X-Token path.
- PDF / file download from `/version/{id}/file` — surface only on demand.

## 11. Decisions captured (v2)

| # | Decision | Source |
|---|---|---|
| 1 | Eliminate snapshots; derive history from raw timestamps; live time-travel UI | User answer round 1 |
| 2 | Fold A007 (Intro Training) into existing Training tab | User answer round 1 |
| 3 | BR tab focuses on "downstream not yet released" with pooling tree | User answer round 1 |
| 4 | Harvest user names from instance OrganizationChartUnitSelector fields, persist in Firestore `bizzmine_meta/users` | Probed and confirmed |
| 5 | Manual sync only; "Sync Now" button on Total Overview with last-synced indicator | User answer round 1 |
| 6 | CSV uploader retained as fallback initially, moved to Settings, removed after 1 month of stable API | User answer round 1 + recommendation |
| 7 | No CSV-API hybrid mode (one source at a time, last-loaded wins) | Recommendation |
| 8 | Architecture: Next.js API routes only (no separate Cloud Function) | Recommendation |

## 12. Final decisions (round 2)

| # | Decision |
|---|---|
| First-sync UX | Empty state with prominent "Sync Now" CTA on Total Overview. Nothing auto-loads. |
| Sync scope | One global Sync Now button fetches all 9 collections in parallel; one click refreshes every tab |
| Time-travel reference | Default = 2 weeks ago. Quick options: 3 weeks, 4 weeks. Plus a custom date picker. |
| Open Tasks placement | Standalone top-level tab (visibility) — accept default |
| Key management | One production key, stored in **Firebase Secret Manager** (Google's separate secret-storage service, not Firestore). Joakim provides the key at the moment the implementation plan asks for it. |

## 13. User's stated payoff target

> "This should allow us to get a much better picture of how and when things move phases in the overdue visual. I hope we can create a significant improvement from this."

The phrase "how and when things move phases" indicates the user wants more than just count-trend deltas — they want phase-transition visibility. This means the overdue visualization on Total Overview should evolve to show:

- **Phase-transition timeline:** "12 records entered 'QA approval' in the last 2 weeks; 8 left it; net +4 stuck"
- **Stuck-record detection:** "Records that were in step X two weeks ago and are still there today" (the bottleneck signal)
- **Phase-aging distributions:** for each pending step, the age distribution of records currently in it

To deliver this richly, Phase 4.1 (snapshot-free time-travel) should pull in pieces of Phase 4.4 (per-step executors) — at least at the aggregate level — instead of being purely top-level CompletedOn-driven. The implementation plan should treat 4.1 + parts of 4.4 as **the headline payoff** and stage them earlier than originally drafted.

---

**Next step:** invoke `superpowers:writing-plans` to produce a concrete file-by-file implementation plan for Phase 1 + Phase 2 + the headline overdue-visualization improvement.
