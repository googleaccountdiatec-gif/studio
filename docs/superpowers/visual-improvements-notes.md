# Visual Improvement Notes — observed during BizzMine API integration

A running log of visual / UX issues and ideas spotted while reading dashboard code during implementation. Not committed as a fix list — just observations to discuss later.

**Format:** `[date] [tab/file] — observation — suggested improvement (if any)`

---

- **2026-04-29 — Settings page (`settings-page.tsx`)** — The page renders independent `<GlassCard>` panels stacked vertically with the same swirly mist background animating behind all of them. With BizzMine Connection added, that's 3 cards (4 once a "Manual data override" / CSV-fallback panel lands in Phase 5). The cards re-render the same animated background separately; there's no shared layout container. *Suggestion:* group them under a single scrolling container with section headers — reduces visual noise from repeated glass effects, makes "scroll for more settings" obvious. Keep the mist background but render it once at the page level, not per card.

- **2026-04-29 — Settings page (`settings-page.tsx`)** — Each `GlassCard` is hardcoded `max-w-2xl`. On wide displays (most users have 1080p+) there's a lot of dead space on either side. *Suggestion:* `max-w-3xl` or `max-w-4xl` for content-heavy panels (Team Management, future BizzMine sync history). Keep small panels (BizzMine Connection — basically a button + status line) at `max-w-2xl`.
