# Visual Improvement Notes — observed during BizzMine API integration

A running log of visual / UX issues and ideas spotted while reading dashboard code during implementation. Not committed as a fix list — just observations to discuss later.

**Format:** `[date] [tab/file] — observation — suggested improvement (if any)`

---

- **2026-04-29 — Settings page (`settings-page.tsx`)** — The page renders independent `<GlassCard>` panels stacked vertically with the same swirly mist background animating behind all of them. With BizzMine Connection added, that's 3 cards (4 once a "Manual data override" / CSV-fallback panel lands in Phase 5). The cards re-render the same animated background separately; there's no shared layout container. *Suggestion:* group them under a single scrolling container with section headers — reduces visual noise from repeated glass effects, makes "scroll for more settings" obvious. Keep the mist background but render it once at the page level, not per card.

- **2026-04-29 — Settings page (`settings-page.tsx`)** — Each `GlassCard` is hardcoded `max-w-2xl`. On wide displays (most users have 1080p+) there's a lot of dead space on either side. *Suggestion:* `max-w-3xl` or `max-w-4xl` for content-heavy panels (Team Management, future BizzMine sync history). Keep small panels (BizzMine Connection — basically a button + status line) at `max-w-2xl`.

- **2026-04-29 — Phase 2 verification** — User noted CAPA Effectiveness-overdue numbers don't quite match the previous CSV-derived figures. Not visual per se, but worth investigating. Likely causes: (a) API returns all records vs CSV maybe pre-filtered, (b) records added/closed since last CSV, (c) `pendingSteps.toLowerCase().includes('effectiveness')` branch logic in `compendium-dashboard.tsx:172` may pick the wrong deadline if the API's `Pending Steps` text differs from the CSV's. *Action:* Phase 2.5 — build a debug page that loads CAPA from API + last CSV side-by-side, diffs records by ID, logs which records changed phase classification and why. Run before Phase 3 widens the API surface so the diff stays manageable.

- **2026-04-29 — Other tabs (NC, Change Actions, Changes, Documents, Training, Batch Release)** — After API sync, these render but most fields show empty / `[object Object]` because their normalizers don't exist yet (Phase 3). Currently we let them render anyway. *Suggestion for Phase 2.5 / before merging:* gate non-CAPA tabs behind a "Phase 3 placeholder" inside `DashboardSlot` (e.g. when `hasEverSynced` AND `code !== 'CAPA'` AND `records[0]` doesn't have CSV-shape headers, show "API data for this tab arrives in Phase 3 — use CSV upload as a temporary fallback"). Avoids the user seeing visibly broken dashboards in the interim.
