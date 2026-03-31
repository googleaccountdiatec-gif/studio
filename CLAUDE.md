# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (uses Next.js with Turbopack)
- **Build:** `npm run build` (sets NODE_ENV=production)
- **Lint:** `npm run lint`
- **Type check:** `npm run typecheck`

## Architecture

This is a **Next.js 15** single-page KPI dashboard app ("KPI Insights") for a pharmaceutical/biotech company (Curida AS). It tracks quality metrics across multiple domains. Deployed via **Firebase App Hosting**.

### Data Flow

All KPI data is loaded client-side via CSV/TSV file uploads through `MultiUploader` (header component). The uploader auto-detects file type (CAPA, Change Action, NC, Training, Batch Release, Documents in Flow) by matching header columns, then parses with a custom state-machine CSV parser that auto-detects delimiters (comma, semicolon, tab).

Parsed data is stored in `DataContext` (`src/contexts/data-context.tsx`) — a React Context providing state and setters for each data type. All dashboard components consume data via the `useData()` hook.

**Firestore** is used only for persisting biweekly metric snapshots (`biweekly_snapshots` collection), not for the primary KPI data.

### Page Structure

Single page app (`src/app/page.tsx`) with tabbed navigation:
- **Total Overview (Compendium)** — aggregated executive summary
- **Batch Release, CAPA, Change Action, Documents in Flow, Non-conformance, Training** — individual KPI dashboards
- **Settings** — production team member list (persisted to localStorage via `src/lib/teams.ts`), color palette selection

### Key Patterns

- **UI Components:** shadcn/ui (Radix primitives + Tailwind). Components in `src/components/ui/`. Config in `components.json`.
- **Charts:** Recharts. Clickable charts drill down into data tables.
- **Theming:** `next-themes` with 5 themes: light, dark, rose, slate, curida. CSS variables defined in `src/app/globals.css`.
- **Path alias:** `@/*` maps to `./src/*`.
- **All dashboard components are client components** (`"use client"`).

### Firebase Config

Firebase config is read from `NEXT_PUBLIC_FIREBASE_*` env vars (set in `apphosting.yaml` for deployment). Firestore initialized in `src/lib/firebase.ts`.

### Type Definitions

Shared types (CapaData, DocumentKpiData, MetricSnapshot) in `src/lib/types.ts`. Many dashboard components use inline `[key: string]: any` interfaces for loosely-typed imported data.

### Build Notes

TypeScript and ESLint errors are ignored during builds (`next.config.ts`). Run `npm run typecheck` separately to check types.
