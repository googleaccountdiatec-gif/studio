# BizzMine API Integration — Phase 1 + Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secure server-side BizzMine API foundation and convert the CAPA dashboard from CSV uploads to live API data, while preserving full visual/functional parity.

**Architecture:** Next.js 15 API routes act as an authenticated proxy: browser → `/api/bizzmine/...` → server-side fetch with `X-Token` + `X-Tenant` headers from Firebase Secret Manager → BizzMine REST API. A normalization layer maps BizzMine `BookmarkName` field shapes (e.g. `CAPA_Tittle`, `{value, text}` comboboxes, `[{type, id, value}]` users) to the CSV-header shape today's dashboards consume — so dashboards work unchanged. A user-name harvester walks every record's OrganizationChartUnitSelector fields to build a tenant-wide `id → name` lookup persisted to Firestore.

**Tech Stack:**
- Next.js 15 (App Router, route handlers)
- TypeScript (strict mode already on)
- Vitest + @testing-library/react (NEW — no test runner exists today)
- Firebase Secret Manager via `apphosting.yaml`
- Existing: React 18, Tailwind, shadcn/ui, Firestore (via firebase SDK)

**Source spec:** `docs/superpowers/specs/2026-04-29-bizzmine-api-integration-design.md`

**Out of scope for this plan (deferred to follow-up plans):**
- Phase 3 — remaining 8 collection normalizers (NC, Change Actions, Changes, KPI_batch_release, BR, DC, A004+A007 merged)
- Phase 4.1 — snapshot-free time-travel headline payoff (depends on Phase 3 data)
- Phase 4.2–4.10 — Batch Registry tab, workflow timeline, open tasks, reassignment heuristic, etc.
- Phase 5 — CSV uploader removal

---

## File Structure

### Files to CREATE

```
vitest.config.ts                                   # Test runner config
vitest.setup.ts                                    # Test env setup (jest-dom matchers)
.env.local.example                                 # Local dev env template (committed)

src/lib/bizzmine/
  config.ts                                        # Collection registry, base URL, tenant
  types.ts                                         # Raw API + normalized output types
  errors.ts                                        # ApiError, ConfigError typed errors
  client.ts                                        # Server-only fetch wrapper (X-Token, X-Tenant)
  normalize/
    index.ts                                       # Generic field-type normalizers
    capa.ts                                        # CAPA BookmarkName → CSV-header mapper
  users.ts                                         # Harvest id→name from instance data + Firestore persistence
  fixtures/
    capa-instance.fixture.json                     # Sanitized real-API record for tests
    capa-instance-array.fixture.json               # Wrapped array form (matches real /instances response)

src/lib/bizzmine/__tests__/
  client.test.ts                                   # fetch wrapper unit tests
  normalize-generic.test.ts                        # combobox unwrap, OrgChart flatten, HTML strip, date
  normalize-capa.test.ts                           # CAPA-specific mapping
  users.test.ts                                    # User harvesting

src/app/api/bizzmine/
  health/route.ts                                  # GET /api/bizzmine/health → BizzMine /AD/info
  collection/[code]/route.ts                       # GET /api/bizzmine/collection/CAPA → normalized records
  users/route.ts                                   # GET /api/bizzmine/users → harvested id→name map
  sync/route.ts                                    # POST /api/bizzmine/sync → fan-out fetch + normalize

src/components/
  sync-now-button.tsx                              # "Sync Now" button + relative-time indicator
  bizzmine-empty-state.tsx                         # Empty-state CTA before first sync
  bizzmine-connection-panel.tsx                    # Settings panel: Test Connection + status
```

### Files to MODIFY

```
package.json                                       # Add vitest + @testing-library deps + scripts
tsconfig.json                                      # Add vitest globals to types
apphosting.yaml                                    # Add BIZZMINE_API_BASE, BIZZMINE_TENANT, BIZZMINE_TOKEN secret binding
src/contexts/data-context.tsx                      # Add lastSyncedAt, syncStatus, sync() method
src/components/settings-page.tsx                   # Add BizzMine Connection card
src/app/page.tsx                                   # Show empty state when no sync; replace MultiUploader with SyncNowButton in header
```

### Files NOT modified (intentionally untouched in this plan)

- All existing dashboards (`*-dashboard.tsx`) — they consume the same data shape they do today
- `multi-uploader.tsx` — kept for fallback (moved out of header but still mounted in Settings, deferred to a Phase 5 plan)
- `firestore.rules` — wide-open today, fine for `bizzmine_meta` collection

---

## Phase 1 — Foundation

### Task 1: Add Vitest + testing dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `tsconfig.json`

The current project has zero test infrastructure. We need a fast test runner that works with TypeScript and the Next.js bundler. Vitest is native ESM, integrates with the existing Vite-style toolchain Next 15 uses for Turbopack, and runs Node + jsdom environments.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 2: Add test scripts to `package.json`**

In the `scripts` block, add three lines after the existing `typecheck` line:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: Create `vitest.config.ts` at project root**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Create `vitest.setup.ts` at project root**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add vitest globals to `tsconfig.json`**

In the `compilerOptions` block, add a `types` array after `"plugins"`:

```json
"types": ["vitest/globals", "@testing-library/jest-dom"],
```

- [ ] **Step 6: Verify the runner works with a sanity test**

Create `src/__tests__/sanity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('vitest sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed, 1 total. PASS.

- [ ] **Step 7: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts tsconfig.json src/__tests__/sanity.test.ts
git commit -m "chore: add vitest test runner with jsdom + testing-library"
```

---

### Task 2: Add BizzMine env vars to apphosting.yaml and document local setup

**Files:**
- Modify: `apphosting.yaml`
- Create: `.env.local.example`

Production secrets live in Firebase Secret Manager. Local dev uses `.env.local` (already gitignored via `.env*`). We commit a `.env.local.example` with empty values so future contributors know the shape.

- [ ] **Step 1: Add BizzMine env block to `apphosting.yaml`**

Append to the `env:` list, after the existing `NEXT_PUBLIC_FIREBASE_APP_ID` block:

```yaml
  # BizzMine API
  - variable: BIZZMINE_API_BASE
    value: "https://diatec-api.bizzmine.cloud"
    availability: [RUNTIME]
  - variable: BIZZMINE_TENANT
    value: "diatec-live"
    availability: [RUNTIME]
  - variable: BIZZMINE_TOKEN
    secret: bizzmine-token
    availability: [RUNTIME]
```

**Critical:** `availability: [RUNTIME]` only — never include `BUILD`. RUNTIME-only ensures the secret never gets baked into the bundled JS sent to the browser.

- [ ] **Step 2: Create `.env.local.example` at project root**

```
# BizzMine API (mirror in production via Firebase Secret Manager)
BIZZMINE_API_BASE=https://diatec-api.bizzmine.cloud
BIZZMINE_TENANT=diatec-live
BIZZMINE_TOKEN=
```

- [ ] **Step 3: Commit**

```bash
git add apphosting.yaml .env.local.example
git commit -m "chore: add BIZZMINE_* env config (token via Firebase Secret Manager)"
```

---

### Task 3: Create collection registry and config

**Files:**
- Create: `src/lib/bizzmine/config.ts`

Single source of truth for collection codes, the API base, and tenant. Avoids string-literal duplication elsewhere.

- [ ] **Step 1: Create the file**

```typescript
import 'server-only';

export const BIZZMINE_API_BASE =
  process.env.BIZZMINE_API_BASE ?? 'https://diatec-api.bizzmine.cloud';

export const BIZZMINE_TENANT =
  process.env.BIZZMINE_TENANT ?? 'diatec-live';

export const BIZZMINE_TOKEN = process.env.BIZZMINE_TOKEN ?? '';

export const COLLECTION_CODES = {
  capa: 'CAPA',
  nc: 'NC',
  changeActions: 'Change_Actions',
  changes: 'CM',
  batchRelease: 'KPI_batch_release',
  batchRegistry: 'BR',
  documents: 'DC',
  training: 'A004',
  introTraining: 'A007',
} as const;

export type CollectionKey = keyof typeof COLLECTION_CODES;
export type CollectionCode = (typeof COLLECTION_CODES)[CollectionKey];

/**
 * Set of known/supported collection codes — used to reject unsupported
 * `[code]` route params at the API boundary.
 */
export const KNOWN_COLLECTION_CODES: ReadonlySet<string> = new Set(
  Object.values(COLLECTION_CODES),
);
```

The `import 'server-only'` directive (provided by Next.js) makes any accidental import from a Client Component a build-time error — protects the token.

- [ ] **Step 2: Commit**

```bash
git add src/lib/bizzmine/config.ts
git commit -m "feat(bizzmine): add server-only config and collection registry"
```

---

### Task 4: Create types

**Files:**
- Create: `src/lib/bizzmine/types.ts`

Captures the field shapes confirmed during probing (recorded in the spec §2.2 and §2.4).

- [ ] **Step 1: Create the file**

```typescript
/** Raw shape returned by BizzMine `/collection/{code}/instances`. */
export type RawInstance = Record<string, unknown>;

/** Combobox / RadioGroup field shape. */
export interface ComboboxValue {
  value: number;
  text: string;
}

/** OrganizationChartUnitSelector field shape. */
export interface OrgChartEntry {
  /** 1 = individual user, 2 = group/team, 3-5 not yet observed. */
  type: number;
  id: number;
  value: string;
}

/** Sub-collection (GridRecord) wrapper for embedded linked records. */
export interface SubCollectionEntry {
  CrossLinkInstancesID?: number;
  DataDesignCrossID?: number;
  OriginalChildInstancesID?: number;
  [field: string]: unknown;
}

/** Open-task shape returned by `/collection/{code}/tasks`. */
export interface OpenTask {
  ID: number;
  CollectionsID: number;
  InstancesID: number;
  VersionsID: number;
  StepVersionsID: number;
  StepName: string;
  Subject: string;
  Body: string;
  DueDate: string;
  Assignees: Array<{ ObjectID: number; ObjectType: number; Name: string }>;
}

/** Result of harvesting users from instance data. */
export interface HarvestedUser {
  /** 1 = user, 2 = group. */
  type: number;
  name: string;
  /** ISO timestamp when this id was last observed in fresh API data. */
  lastSeenAt: string;
  /** Collection codes where this id appeared. */
  sourceCollections: string[];
}

export type UsersById = Record<number, HarvestedUser>;

/** AD/info response (used by health check). */
export interface AdInfoResponse {
  ADDomain: string;
  ValidLicense: boolean;
  AADClientID: string;
  AADClientSecret: string;
  ADMode: number;
  Version: string;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bizzmine/types.ts
git commit -m "feat(bizzmine): add type definitions for raw API + harvested users"
```

---

### Task 5: Create typed errors

**Files:**
- Create: `src/lib/bizzmine/errors.ts`

Lets the route handlers translate failures into clean HTTP responses instead of leaking stack traces.

- [ ] **Step 1: Create the file**

```typescript
/** Configuration is missing (e.g., BIZZMINE_TOKEN unset). */
export class ConfigError extends Error {
  readonly code = 'CONFIG_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** BizzMine returned a non-2xx response. */
export class ApiError extends Error {
  readonly code = 'API_ERROR';
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Network or transport failure (timeout, DNS, abort). */
export class TransportError extends Error {
  readonly code = 'TRANSPORT_ERROR';
  constructor(
    message: string,
    readonly path: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bizzmine/errors.ts
git commit -m "feat(bizzmine): add typed error classes for config/API/transport failures"
```

---

### Task 6: Build the server-side BizzMine fetch client (TDD)

**Files:**
- Create: `src/lib/bizzmine/client.ts`
- Create: `src/lib/bizzmine/__tests__/client.test.ts`

The client is a thin wrapper around `fetch` that injects auth headers, handles errors, and never logs the token.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/bizzmine/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, ConfigError, TransportError } from '../errors';

describe('BizzmineClient.get', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.BIZZMINE_API_BASE = 'https://example.test';
    process.env.BIZZMINE_TENANT = 'test-tenant';
    process.env.BIZZMINE_TOKEN = 'test-token';
    // Reset module cache so config picks up new env
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws ConfigError when token is missing', async () => {
    process.env.BIZZMINE_TOKEN = '';
    vi.resetModules();
    const { BizzmineClient } = await import('../client');
    await expect(BizzmineClient.get('/AD/info')).rejects.toBeInstanceOf(ConfigError);
  });

  it('sends X-Token and X-Tenant headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ Version: '6.0.44.5' }), { status: 200 }),
    );
    const { BizzmineClient } = await import('../client');
    await BizzmineClient.get('/AD/info');
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['X-Token']).toBe('test-token');
    expect(options.headers['X-Tenant']).toBe('test-tenant');
  });

  it('returns parsed JSON on 200', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const { BizzmineClient } = await import('../client');
    const result = await BizzmineClient.get<{ ok: boolean }>('/AD/info');
    expect(result).toEqual({ ok: true });
  });

  it('throws ApiError with status on 4xx/5xx', async () => {
    fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const { BizzmineClient } = await import('../client');
    await expect(BizzmineClient.get('/AD/info')).rejects.toMatchObject({
      code: 'API_ERROR',
      status: 401,
    });
  });

  it('throws TransportError on network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network down'));
    const { BizzmineClient } = await import('../client');
    await expect(BizzmineClient.get('/AD/info')).rejects.toBeInstanceOf(TransportError);
  });

  it('does not include the token in any thrown error message', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const { BizzmineClient } = await import('../client');
    try {
      await BizzmineClient.get('/AD/info');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain('test-token');
    }
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not yet created)**

Run: `npm test src/lib/bizzmine/__tests__/client.test.ts`
Expected: errors about `Cannot find module '../client'`.

- [ ] **Step 3: Implement the client**

Create `src/lib/bizzmine/client.ts`:

```typescript
import 'server-only';
import { BIZZMINE_API_BASE, BIZZMINE_TENANT, BIZZMINE_TOKEN } from './config';
import { ApiError, ConfigError, TransportError } from './errors';

const DEFAULT_TIMEOUT_MS = 60_000;

function assertConfig(): void {
  if (!BIZZMINE_TOKEN) {
    throw new ConfigError(
      'BIZZMINE_TOKEN is not set. Add it to .env.local for local dev or to ' +
        'Firebase Secret Manager (`firebase apphosting:secrets:set bizzmine-token`) for deployment.',
    );
  }
  if (!BIZZMINE_TENANT) {
    throw new ConfigError('BIZZMINE_TENANT is not set.');
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  assertConfig();

  const url = `${BIZZMINE_API_BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  // Forward an external signal if provided
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'X-Token': BIZZMINE_TOKEN,
        'X-Tenant': BIZZMINE_TENANT,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    throw new TransportError(
      `Network failure calling BizzMine ${method} ${path}`,
      path,
      cause,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Read body but DO NOT include token in error message
    const text = await response.text().catch(() => '');
    throw new ApiError(
      `BizzMine ${method} ${path} returned ${response.status}: ${text.slice(0, 200)}`,
      response.status,
      path,
    );
  }

  return (await response.json()) as T;
}

export const BizzmineClient = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>('GET', path, { signal }),
  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>('POST', path, { body, signal }),
};
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test src/lib/bizzmine/__tests__/client.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bizzmine/client.ts src/lib/bizzmine/__tests__/client.test.ts
git commit -m "feat(bizzmine): add server-only fetch client with auth, timeout, typed errors"
```

---

### Task 7: Generic field-type normalizers (TDD)

**Files:**
- Create: `src/lib/bizzmine/normalize/index.ts`
- Create: `src/lib/bizzmine/__tests__/normalize-generic.test.ts`

Reusable transforms for the field types observed across collections during probing: combobox-unwrap, OrgChart-flatten, HTML-strip, date-passthrough, integer-coerce.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/bizzmine/__tests__/normalize-generic.test.ts
import { describe, it, expect } from 'vitest';
import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIntOrEmpty,
  toIsoDate,
} from '../normalize';

describe('unwrapCombobox', () => {
  it('returns the .text from a combobox object', () => {
    expect(unwrapCombobox({ value: 64, text: 'Normal' })).toBe('Normal');
  });

  it('returns empty string for an empty/undefined value', () => {
    expect(unwrapCombobox(undefined)).toBe('');
    expect(unwrapCombobox(null)).toBe('');
    expect(unwrapCombobox('')).toBe('');
  });

  it('returns the original string when already a string', () => {
    expect(unwrapCombobox('Already a string')).toBe('Already a string');
  });
});

describe('flattenOrgChart', () => {
  it('returns the .value from a single-entry array', () => {
    expect(
      flattenOrgChart([{ type: 1, id: 14, value: 'Anna Huk' }]),
    ).toBe('Anna Huk');
  });

  it('joins multiple entries with commas', () => {
    expect(
      flattenOrgChart([
        { type: 1, id: 14, value: 'Anna Huk' },
        { type: 2, id: 15, value: 'QA Team' },
      ]),
    ).toBe('Anna Huk, QA Team');
  });

  it('returns empty string for empty/undefined input', () => {
    expect(flattenOrgChart([])).toBe('');
    expect(flattenOrgChart(undefined)).toBe('');
    expect(flattenOrgChart(null)).toBe('');
  });
});

describe('stripHtml', () => {
  it('strips <div> and <p> tags but keeps text', () => {
    expect(stripHtml('<div><p>Hello</p> world</div>')).toBe('Hello world');
  });

  it('collapses whitespace', () => {
    expect(stripHtml('<div>foo   <br>  bar</div>')).toBe('foo bar');
  });

  it('returns empty string for empty/undefined input', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('')).toBe('');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtml('&amp; &lt;tag&gt; &nbsp;ok')).toBe('& <tag>  ok');
  });
});

describe('toIntOrEmpty', () => {
  it('converts numeric floats like 1.0 to 1', () => {
    expect(toIntOrEmpty(1.0)).toBe(1);
    expect(toIntOrEmpty(213)).toBe(213);
  });

  it('parses numeric strings', () => {
    expect(toIntOrEmpty('42')).toBe(42);
  });

  it('returns empty string for empty/undefined/non-numeric', () => {
    expect(toIntOrEmpty('')).toBe('');
    expect(toIntOrEmpty(undefined)).toBe('');
    expect(toIntOrEmpty('not a number')).toBe('');
  });
});

describe('toIsoDate', () => {
  it('converts US-format BizzMine dates to ISO 8601', () => {
    // BizzMine: "1/24/2022 12:48:45 PM +00:00"
    const result = toIsoDate('1/24/2022 12:48:45 PM +00:00');
    expect(result).toBe('2022-01-24T12:48:45.000Z');
  });

  it('passes through ISO 8601 unchanged-shape', () => {
    expect(toIsoDate('2022-11-30T15:38:05.2395774+00:00')).toBe(
      '2022-11-30T15:38:05.239Z',
    );
  });

  it('returns empty string for empty/undefined', () => {
    expect(toIsoDate('')).toBe('');
    expect(toIsoDate(undefined)).toBe('');
  });

  it('returns empty string for unparseable input', () => {
    expect(toIsoDate('not a date')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test src/lib/bizzmine/__tests__/normalize-generic.test.ts`
Expected: cannot find `../normalize`.

- [ ] **Step 3: Implement the normalizers**

Create `src/lib/bizzmine/normalize/index.ts`:

```typescript
import type { ComboboxValue, OrgChartEntry } from '../types';

export function unwrapCombobox(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && input !== null && 'text' in input) {
    const text = (input as ComboboxValue).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
}

export function flattenOrgChart(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (!Array.isArray(input)) return '';
  return input
    .map((e: OrgChartEntry) =>
      typeof e?.value === 'string' ? e.value : '',
    )
    .filter(Boolean)
    .join(', ');
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function stripHtml(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input !== 'string') return '';

  // 1. Replace <br>, </p>, </div> with spaces (preserve word boundaries)
  let s = input.replace(/<\/?(br|p|div|tr|li)\s*\/?>/gi, ' ');
  // 2. Strip remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // 3. Decode common entities
  s = s.replace(
    /&(amp|lt|gt|quot|#39|nbsp);/g,
    (m) => HTML_ENTITIES[m] ?? m,
  );
  // 4. Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function toIntOrEmpty(input: unknown): number | '' {
  if (input === null || input === undefined || input === '') return '';
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n)) return '';
  return Math.trunc(n);
}

// Matches BizzMine US-format dates like "1/24/2022 12:48:45 PM +00:00".
// V8's permissive Date parser accepts most variants but the trailing
// "+00:00" after "AM/PM" is non-standard, so we provide a fallback.
const BIZZMINE_DATE_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+([+-]\d{2}):?(\d{2})$/i;

export function toIsoDate(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input !== 'string') return '';

  // 1. Try native parser first (handles ISO 8601 cleanly)
  const native = new Date(input);
  if (!Number.isNaN(native.getTime())) return native.toISOString();

  // 2. Fallback: parse BizzMine US format
  const m = input.match(BIZZMINE_DATE_RE);
  if (m) {
    const [, mo, d, y, h, mi, s, ampm, tzH, tzM] = m;
    let hour = parseInt(h, 10);
    if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    const iso =
      `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` +
      `T${String(hour).padStart(2, '0')}:${mi}:${s}${tzH}:${tzM}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return '';
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test src/lib/bizzmine/__tests__/normalize-generic.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bizzmine/normalize/index.ts src/lib/bizzmine/__tests__/normalize-generic.test.ts
git commit -m "feat(bizzmine): add generic field-type normalizers (combobox, OrgChart, HTML, date, int)"
```

---

### Task 8: Save sanitized CAPA fixture for tests

**Files:**
- Create: `src/lib/bizzmine/fixtures/capa-instance.fixture.json`
- Create: `src/lib/bizzmine/fixtures/capa-instance-array.fixture.json`

Tests in Tasks 12 (CAPA mapper) and 13 (user harvester) need a real-shape API record. Sanitize: keep field shapes, replace any sensitive memo content with `[REDACTED]` and PII names with synthetic ones.

- [ ] **Step 1: Create the single-record fixture**

This fixture mirrors the shape probed live (per spec §2.1, §2.2). Names replaced with synthetic ones; memo bodies redacted.

```json
{
  "CAPA_Plan": "<p>[REDACTED memo content]</p>",
  "CAPA_Do": "<p>[REDACTED memo content]</p>",
  "CAPA_Description": "[REDACTED memo content]",
  "CAPA_EffectivenessOK": { "value": 61, "text": "CAPA was effective" },
  "CAPA_AssignedTo": [{ "type": 1, "id": 12, "value": "Test User Alpha" }],
  "CAPA_Priority": { "value": 64, "text": "Normal" },
  "CAPA_Type": { "value": 67, "text": "Preventive Action" },
  "CAPA_Category": { "value": 193, "text": "System /process" },
  "CAPA_DueDate": "3/31/2022 12:00:00 AM +00:00",
  "CAPA_Resolution_Bad_Eff": "NA",
  "CAPA_OriginalID": "NA",
  "CAPA_Proposedresponsible": [{ "type": 1, "id": 12, "value": "Test User Alpha" }],
  "CAPA_Tittle": "Sample CAPA title",
  "CAPA_CAPAexecutionQAApproval": "",
  "CAPA_CAPAexecutionQAComments": "",
  "CAPA_Deadlineforeffectivenesscheck": "",
  "CAPA_Finalcomments": "",
  "CAPA_CAPAapprovedforexecution": "",
  "CAPA_CAPAApprovedforexecutionAdditionalcomment": "",
  "CAPA_CAPAexecutionplanverifier": "",
  "CAPA_CAPAExecutionplantechnicalverification": "",
  "CAPA_Commenttechnicalverification": "",
  "CAPA_Effectivenessevaluation": "",
  "CAPA_CAPAID": 1.0,
  "CAPA_Actiontaken": { "value": 423, "text": "Action performed" },
  "CAPA_ExpectedresultsofAction": "<div>[REDACTED]</div>",
  "CAPA_CAPAID_System": 1.0,
  "CAPA_RegistrationTime": "1/24/2022 12:48:45 PM +00:00",
  "CAPA_RegisteredOnBehalfOf": [{ "type": 1, "id": 12, "value": "Test User Alpha" }],
  "CAPA_CompletedOn": "11/24/2022 7:22:17 PM +00:00",
  "CAPA_Status": 3,
  "CAPA_EarliestDueDate": "",
  "CAPA_RegistrationYear": 2022.0,
  "CAPA_RegistrationMonth": 1.0,
  "CAPA_RegistrationQuarter": 1.0,
  "CAPA_RegisteredBy": [{ "type": 1, "id": 12, "value": "Test User Alpha" }],
  "CAPA_RegistrationYearWeek": "2022-04",
  "CAPA_RegistrationWeek": 4.0,
  "CAPA_RegistrationYearMonth": "2022-01",
  "CAPA_RegistrationYearQuarter": "2022-01",
  "CAPA_PendingSteps": "",
  "NonConformances": [
    {
      "CrossLinkInstancesID": 3,
      "DataDesignCrossID": 3,
      "OriginalChildInstancesID": 3,
      "NonConformances_NC_Title": "Linked NC title",
      "NonConformances_NC_NonConformanceID": 3.0
    }
  ],
  "Incidents": [],
  "Document": [],
  "Attachments": []
}
```

- [ ] **Step 2: Create the array-form fixture**

```json
[
  { "$ref": "./capa-instance.fixture.json" }
]
```

Wait — JSON does not support `$ref`. Instead, write it as a real array of one record by inlining. Replace the file content with:

```json
[
  {
    "CAPA_Tittle": "Sample CAPA title",
    "CAPA_CAPAID": 1.0,
    "CAPA_DueDate": "3/31/2022 12:00:00 AM +00:00",
    "CAPA_AssignedTo": [{ "type": 1, "id": 12, "value": "Test User Alpha" }],
    "CAPA_Priority": { "value": 64, "text": "Normal" },
    "CAPA_PendingSteps": "",
    "CAPA_CompletedOn": "11/24/2022 7:22:17 PM +00:00",
    "CAPA_Deadlineforeffectivenesscheck": "",
    "CAPA_Category": { "value": 193, "text": "System /process" },
    "CAPA_Actiontaken": { "value": 423, "text": "Action performed" },
    "CAPA_ExpectedresultsofAction": "<div>Description</div>",
    "CAPA_Description": "[REDACTED]",
    "CAPA_Plan": "<p>[REDACTED]</p>",
    "CAPA_RegistrationTime": "1/24/2022 12:48:45 PM +00:00",
    "CAPA_RegisteredBy": [{ "type": 1, "id": 12, "value": "Test User Alpha" }],
    "CAPA_RegisteredOnBehalfOf": [{ "type": 1, "id": 12, "value": "Test User Alpha" }],
    "CAPA_Proposedresponsible": [{ "type": 1, "id": 14, "value": "Test User Beta" }],
    "NonConformances": [
      { "NonConformances_NC_Title": "Linked NC", "NonConformances_NC_NonConformanceID": 3.0 }
    ]
  },
  {
    "CAPA_Tittle": "Second CAPA",
    "CAPA_CAPAID": 2.0,
    "CAPA_DueDate": "5/15/2024 12:00:00 AM +00:00",
    "CAPA_AssignedTo": [{ "type": 1, "id": 84, "value": "Test User Gamma" }],
    "CAPA_Priority": { "value": 63, "text": "High" },
    "CAPA_PendingSteps": "CAPA Execution",
    "CAPA_CompletedOn": "",
    "CAPA_Deadlineforeffectivenesscheck": "8/15/2024 12:00:00 AM +00:00",
    "CAPA_Category": { "value": 191, "text": "Personnel" },
    "CAPA_Actiontaken": "",
    "CAPA_ExpectedresultsofAction": "",
    "CAPA_Description": "[REDACTED]",
    "CAPA_Plan": "",
    "CAPA_RegistrationTime": "5/1/2024 9:30:00 AM +00:00",
    "CAPA_RegisteredBy": [{ "type": 1, "id": 14, "value": "Test User Beta" }],
    "CAPA_RegisteredOnBehalfOf": [{ "type": 1, "id": 14, "value": "Test User Beta" }],
    "CAPA_Proposedresponsible": [{ "type": 2, "id": 99, "value": "QA Team" }],
    "NonConformances": []
  }
]
```

- [ ] **Step 3: Verify the fixtures parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/lib/bizzmine/fixtures/capa-instance.fixture.json'))"`
Expected: no error.

Run: `node -e "JSON.parse(require('fs').readFileSync('src/lib/bizzmine/fixtures/capa-instance-array.fixture.json'))"`
Expected: no error.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bizzmine/fixtures/
git commit -m "test(bizzmine): add sanitized CAPA fixtures (single + array shapes)"
```

---

### Task 9: Create `/api/bizzmine/health` route

**Files:**
- Create: `src/app/api/bizzmine/health/route.ts`

A small "is the connection alive" endpoint. The Settings page hits this. Returns `{ ok: true, version }` or `{ ok: false, error }` — never leaks the token.

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from 'next/server';
import { BizzmineClient } from '@/lib/bizzmine/client';
import type { AdInfoResponse } from '@/lib/bizzmine/types';
import { ApiError, ConfigError, TransportError } from '@/lib/bizzmine/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const info = await BizzmineClient.get<AdInfoResponse>('/AD/info');
    return NextResponse.json({
      ok: true,
      version: info.Version,
      adMode: info.ADMode,
      validLicense: info.ValidLicense,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json(
        { ok: false, error: 'config', message: e.message },
        { status: 500 },
      );
    }
    if (e instanceof ApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'api',
          status: e.status,
          message: `BizzMine returned ${e.status}`,
        },
        { status: 502 },
      );
    }
    if (e instanceof TransportError) {
      return NextResponse.json(
        { ok: false, error: 'transport', message: 'Network error contacting BizzMine' },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'unknown', message: 'Unexpected error' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bizzmine/health/route.ts
git commit -m "feat(api): add /api/bizzmine/health connectivity check"
```

---

### Task 10: ⚠️ CHECKPOINT — User provides API key

**This task is performed by the human, not the agent.**

The implementation cannot proceed past this point until the BizzMine API key is loaded into both local dev and Firebase Secret Manager. The agent should pause and prompt the user to complete the steps below.

- [ ] **Step 1: Local dev — create `.env.local`**

The user runs in their shell, in the project root:

```bash
cp .env.local.example .env.local
```

Then opens `.env.local` and pastes the key after `BIZZMINE_TOKEN=` so the line reads:

```
BIZZMINE_TOKEN=<paste-the-real-key-here>
```

Save and close. `.env.local` is gitignored (matches `.env*` in `.gitignore`).

- [ ] **Step 2: Production — Firebase Secret Manager**

The user runs interactively (Firebase CLI must be installed and authenticated):

```bash
firebase apphosting:secrets:set bizzmine-token
```

The CLI prompts for the value — the user pastes the key. Confirm. The CLI grants the App Hosting service account access automatically (or prompts to grant; answer yes).

If the user has not used Firebase CLI for App Hosting before, they may also need:

```bash
firebase apphosting:secrets:grantaccess bizzmine-token --backend <backend-name>
```

Where `<backend-name>` is shown in the Firebase console under App Hosting.

- [ ] **Step 3: Verify local dev picks up the key**

The user starts the dev server:

```bash
npm run dev
```

Then in another terminal:

```bash
curl http://localhost:3000/api/bizzmine/health
```

Expected: `{"ok":true,"version":"6.0.44.5",...}` (version may differ on later BizzMine upgrades).

If `{"ok":false,"error":"config",...}` — the key is not loaded; restart the dev server after editing `.env.local`.

If `{"ok":false,"error":"api","status":401,...}` — the key is wrong, or the tenant header is wrong.

- [ ] **Step 4: Tell the agent the connection works**

Once the curl above returns `ok:true`, the user signals the agent to continue. The agent must NOT proceed to Task 11 without this confirmation.

---

### Task 11: Add BizzMine Connection panel to Settings

**Files:**
- Create: `src/components/bizzmine-connection-panel.tsx`
- Modify: `src/components/settings-page.tsx`

A user-facing way to verify the connection. Calls `/api/bizzmine/health`, displays version + status with green/red indicator.

- [ ] **Step 1: Create the panel component**

```typescript
// src/components/bizzmine-connection-panel.tsx
"use client";

import React, { useState } from 'react';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { CheckCircle2, XCircle, Loader2, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

type HealthState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; version: string; checkedAt: string }
  | { kind: 'error'; message: string };

export function BizzmineConnectionPanel() {
  const [state, setState] = useState<HealthState>({ kind: 'idle' });

  const test = async () => {
    setState({ kind: 'checking' });
    try {
      const r = await fetch('/api/bizzmine/health');
      const data = await r.json();
      if (data.ok) {
        setState({
          kind: 'ok',
          version: data.version,
          checkedAt: data.checkedAt,
        });
      } else {
        setState({
          kind: 'error',
          message: data.message ?? 'Unknown error',
        });
      }
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Network error',
      });
    }
  };

  return (
    <GlassCard className="w-full max-w-2xl p-8 z-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-6 w-6" />
          BizzMine Connection
        </CardTitle>
        <CardDescription>
          Verify the server can reach the BizzMine REST API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Button onClick={test} disabled={state.kind === 'checking'}>
            {state.kind === 'checking' && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Test Connection
          </Button>
          {state.kind === 'ok' && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Connected — BizzMine v{state.version}</span>
            </div>
          )}
          {state.kind === 'error' && (
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className={cn('text-red-600')}>{state.message}</span>
            </div>
          )}
        </div>
      </CardContent>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Wire it into Settings**

Modify `src/components/settings-page.tsx`. Add the import after the existing imports:

```typescript
import { BizzmineConnectionPanel } from '@/components/bizzmine-connection-panel';
```

Then inside the outer `<div>` (line 78–141 in current file), insert the new panel as the FIRST `GlassCard` (above the Appearance card):

```typescript
<BizzmineConnectionPanel />
```

So the rendered layout becomes: BizzMineConnection → Appearance → Team Management.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
Open: http://localhost:3000 → Settings tab → BizzMine Connection
Click "Test Connection".
Expected: green checkmark with "Connected — BizzMine v6.0.44.5".

- [ ] **Step 4: Commit**

```bash
git add src/components/bizzmine-connection-panel.tsx src/components/settings-page.tsx
git commit -m "feat(settings): add BizzMine Connection test panel"
```

---

## Phase 2 — CAPA pilot

### Task 12: CAPA-specific normalizer (TDD)

**Files:**
- Create: `src/lib/bizzmine/normalize/capa.ts`
- Create: `src/lib/bizzmine/__tests__/normalize-capa.test.ts`

Maps a raw CAPA record to the CSV-header shape the existing `CapaDashboard` expects (see `src/lib/types.ts` → `CapaData` interface and `src/components/capa-dashboard.tsx`).

Output keys (must match existing CSV headers exactly):

| Output | Source | Transform |
|---|---|---|
| `CAPA ID` | `CAPA_CAPAID` | `toIntOrEmpty` then `String()` |
| `Title` | `CAPA_Tittle` (sic) | passthrough |
| `Due Date` | `CAPA_DueDate` | `toIsoDate` |
| `Deadline for effectiveness check` | `CAPA_Deadlineforeffectivenesscheck` | `toIsoDate` |
| `Assigned To` | `CAPA_AssignedTo` | `flattenOrgChart` |
| `Pending Steps` | `CAPA_PendingSteps` | passthrough |
| `Completed On` | `CAPA_CompletedOn` | `toIsoDate` |
| `Category of Corrective Action` | `CAPA_Category` | `unwrapCombobox` |
| `Priority` | `CAPA_Priority` | `unwrapCombobox` |
| `Action taken` | `CAPA_Actiontaken` | `unwrapCombobox` |
| `Expected results of Action` | `CAPA_ExpectedresultsofAction` | `stripHtml` |
| `Action plan` | `CAPA_Plan` | `stripHtml` |
| `Description` | `CAPA_Description` | `stripHtml` |
| `Proposed responsible` | `CAPA_Proposedresponsible` | `flattenOrgChart` |
| `Registration Time` | `CAPA_RegistrationTime` | `toIsoDate` |
| `Registered By` | `CAPA_RegisteredBy` | `flattenOrgChart` |
| `_subCollections.NonConformances` | `record.NonConformances` | passthrough (Phase 3 will normalize sub-records) |

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/bizzmine/__tests__/normalize-capa.test.ts
import { describe, it, expect } from 'vitest';
import fixtureSingle from '../fixtures/capa-instance.fixture.json';
import fixtureArray from '../fixtures/capa-instance-array.fixture.json';
import { normalizeCapaRecord, normalizeCapaInstances } from '../normalize/capa';

describe('normalizeCapaRecord', () => {
  it('maps core fields to CSV-header shape', () => {
    const r = normalizeCapaRecord(fixtureSingle);
    expect(r['CAPA ID']).toBe('1');
    expect(r['Title']).toBe('Sample CAPA title');
    expect(r['Due Date']).toBe('2022-03-31T00:00:00.000Z');
    expect(r['Assigned To']).toBe('Test User Alpha');
    expect(r['Priority']).toBe('Normal');
    expect(r['Category of Corrective Action']).toBe('System /process');
    expect(r['Action taken']).toBe('Action performed');
    expect(r['Pending Steps']).toBe('');
    expect(r['Completed On']).toBe('2022-11-24T19:22:17.000Z');
  });

  it('strips HTML from memo fields', () => {
    const r = normalizeCapaRecord(fixtureSingle);
    expect(r['Action plan']).not.toContain('<p>');
    expect(r['Action plan']).not.toContain('<div>');
    expect(r['Expected results of Action']).not.toContain('<div>');
  });

  it('passes through embedded sub-collections under _subCollections', () => {
    const r = normalizeCapaRecord(fixtureSingle);
    expect(Array.isArray(r._subCollections?.NonConformances)).toBe(true);
    expect(r._subCollections?.NonConformances?.[0]?.NonConformances_NC_Title).toBe(
      'Linked NC title',
    );
  });

  it('handles a record with empty CompletedOn (still pending)', () => {
    const pending = fixtureArray[1];
    const r = normalizeCapaRecord(pending);
    expect(r['Completed On']).toBe('');
    expect(r['Pending Steps']).toBe('CAPA Execution');
    expect(r['Deadline for effectiveness check']).toBe('2024-08-15T00:00:00.000Z');
  });

  it('joins multi-entry OrgChart fields with commas', () => {
    const multi = {
      ...fixtureArray[1],
      CAPA_Proposedresponsible: [
        { type: 1, id: 14, value: 'Test User Beta' },
        { type: 2, id: 99, value: 'QA Team' },
      ],
    };
    const r = normalizeCapaRecord(multi);
    expect(r['Proposed responsible']).toBe('Test User Beta, QA Team');
  });
});

describe('normalizeCapaInstances', () => {
  it('maps an array of records', () => {
    const out = normalizeCapaInstances(fixtureArray);
    expect(out).toHaveLength(2);
    expect(out[0]['Title']).toBe('Sample CAPA title');
    expect(out[1]['Title']).toBe('Second CAPA');
  });

  it('returns empty array for empty input', () => {
    expect(normalizeCapaInstances([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test src/lib/bizzmine/__tests__/normalize-capa.test.ts`
Expected: cannot find `../normalize/capa`.

- [ ] **Step 3: Implement the CAPA normalizer**

```typescript
// src/lib/bizzmine/normalize/capa.ts
import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIntOrEmpty,
  toIsoDate,
} from './index';
import type { RawInstance, SubCollectionEntry } from '../types';

/** Output shape — keys match today's CSV-export headers. */
export interface NormalizedCapa {
  'CAPA ID': string;
  'Title': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
  'Completed On': string;
  'Category of Corrective Action': string;
  'Priority': string;
  'Action taken': string;
  'Expected results of Action': string;
  'Action plan': string;
  'Description': string;
  'Proposed responsible': string;
  'Registration Time': string;
  'Registered By': string;
  /** Embedded linked records (CAPA → NCs, Incidents, Documents, Attachments). */
  _subCollections: Record<string, SubCollectionEntry[]>;
  /** Untyped passthrough for any extra fields the dashboard later consumes. */
  [key: string]: unknown;
}

const SUB_COLLECTION_KEYS = [
  'NonConformances',
  'Incidents',
  'Document',
  'Attachments',
  'CAPA_Customercomplaints',
];

export function normalizeCapaRecord(raw: RawInstance): NormalizedCapa {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  const idOrEmpty = toIntOrEmpty(raw.CAPA_CAPAID);

  return {
    'CAPA ID': idOrEmpty === '' ? '' : String(idOrEmpty),
    'Title': typeof raw.CAPA_Tittle === 'string' ? raw.CAPA_Tittle : '',
    'Due Date': toIsoDate(raw.CAPA_DueDate),
    'Deadline for effectiveness check': toIsoDate(raw.CAPA_Deadlineforeffectivenesscheck),
    'Assigned To': flattenOrgChart(raw.CAPA_AssignedTo),
    'Pending Steps': typeof raw.CAPA_PendingSteps === 'string' ? raw.CAPA_PendingSteps : '',
    'Completed On': toIsoDate(raw.CAPA_CompletedOn),
    'Category of Corrective Action': unwrapCombobox(raw.CAPA_Category),
    'Priority': unwrapCombobox(raw.CAPA_Priority),
    'Action taken': unwrapCombobox(raw.CAPA_Actiontaken),
    'Expected results of Action': stripHtml(raw.CAPA_ExpectedresultsofAction),
    'Action plan': stripHtml(raw.CAPA_Plan),
    'Description': stripHtml(raw.CAPA_Description),
    'Proposed responsible': flattenOrgChart(raw.CAPA_Proposedresponsible),
    'Registration Time': toIsoDate(raw.CAPA_RegistrationTime),
    'Registered By': flattenOrgChart(raw.CAPA_RegisteredBy),
    _subCollections: subs,
  };
}

export function normalizeCapaInstances(raws: RawInstance[]): NormalizedCapa[] {
  return raws.map(normalizeCapaRecord);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test src/lib/bizzmine/__tests__/normalize-capa.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bizzmine/normalize/capa.ts src/lib/bizzmine/__tests__/normalize-capa.test.ts
git commit -m "feat(bizzmine): add CAPA normalizer (BookmarkName -> CSV-header shape)"
```

---

### Task 13: User-name harvester (TDD)

**Files:**
- Create: `src/lib/bizzmine/users.ts`
- Create: `src/lib/bizzmine/__tests__/users.test.ts`

Walks every record's OrganizationChartUnitSelector fields, harvests `id → name` mappings, and persists to Firestore document `bizzmine_meta/users`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/bizzmine/__tests__/users.test.ts
import { describe, it, expect } from 'vitest';
import { harvestUsersFromRecords } from '../users';
import fixtureArray from '../fixtures/capa-instance-array.fixture.json';

describe('harvestUsersFromRecords', () => {
  it('extracts unique user ids and names from OrgChart fields', () => {
    const map = harvestUsersFromRecords({
      CAPA: fixtureArray,
    });
    expect(map[12]).toMatchObject({ name: 'Test User Alpha', type: 1 });
    expect(map[14]).toMatchObject({ name: 'Test User Beta', type: 1 });
    expect(map[84]).toMatchObject({ name: 'Test User Gamma', type: 1 });
  });

  it('captures groups (type 2) the same way', () => {
    const map = harvestUsersFromRecords({ CAPA: fixtureArray });
    expect(map[99]).toMatchObject({ name: 'QA Team', type: 2 });
  });

  it('records sourceCollections for each id', () => {
    const map = harvestUsersFromRecords({ CAPA: fixtureArray });
    expect(map[12].sourceCollections).toContain('CAPA');
  });

  it('merges across multiple collections without duplicating', () => {
    const map = harvestUsersFromRecords({
      CAPA: fixtureArray,
      NC: [
        {
          NC_RegisteredBy: [{ type: 1, id: 12, value: 'Test User Alpha' }],
        },
      ],
    });
    expect(map[12].sourceCollections.sort()).toEqual(['CAPA', 'NC']);
  });

  it('skips non-OrgChart fields gracefully', () => {
    const map = harvestUsersFromRecords({
      CAPA: [
        {
          CAPA_Tittle: 'Just a title',
          CAPA_Priority: { value: 64, text: 'Normal' },
          CAPA_AssignedTo: [{ type: 1, id: 7, value: 'Solo User' }],
        },
      ],
    });
    expect(Object.keys(map)).toEqual(['7']);
  });

  it('stamps lastSeenAt with an ISO timestamp', () => {
    const map = harvestUsersFromRecords({ CAPA: fixtureArray });
    expect(map[12].lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test src/lib/bizzmine/__tests__/users.test.ts`
Expected: cannot find `../users`.

- [ ] **Step 3: Implement the harvester**

```typescript
// src/lib/bizzmine/users.ts
import type { HarvestedUser, OrgChartEntry, RawInstance, UsersById } from './types';

function looksLikeOrgChart(v: unknown): v is OrgChartEntry[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  const first = v[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'id' in first &&
    'value' in first &&
    'type' in first
  );
}

/**
 * Walk every field of every record across all collections and harvest
 * id → name mappings from OrganizationChartUnitSelector fields.
 *
 * Pure function; takes already-fetched instance arrays, returns a map.
 * The Firestore persistence is a separate concern (see persistUsers below).
 */
export function harvestUsersFromRecords(
  byCollection: Record<string, RawInstance[]>,
): UsersById {
  const out: UsersById = {};
  const now = new Date().toISOString();

  for (const [code, records] of Object.entries(byCollection)) {
    for (const record of records) {
      for (const value of Object.values(record)) {
        if (!looksLikeOrgChart(value)) continue;
        for (const entry of value) {
          if (
            typeof entry?.id !== 'number' ||
            typeof entry?.value !== 'string' ||
            !entry.value
          ) {
            continue;
          }
          const existing = out[entry.id];
          if (existing) {
            existing.name = entry.value; // keep latest seen name
            existing.lastSeenAt = now;
            if (!existing.sourceCollections.includes(code)) {
              existing.sourceCollections.push(code);
            }
          } else {
            const harvested: HarvestedUser = {
              type: typeof entry.type === 'number' ? entry.type : 1,
              name: entry.value,
              lastSeenAt: now,
              sourceCollections: [code],
            };
            out[entry.id] = harvested;
          }
        }
      }
    }
  }

  return out;
}

/**
 * Merge a freshly-harvested map with the previously-persisted map from
 * Firestore. Keeps the union of sourceCollections; latest name wins.
 */
export function mergeUserMaps(
  previous: UsersById,
  fresh: UsersById,
): UsersById {
  const out: UsersById = { ...previous };
  for (const [idStr, freshUser] of Object.entries(fresh)) {
    const id = Number(idStr);
    const prev = out[id];
    if (!prev) {
      out[id] = freshUser;
      continue;
    }
    const merged: HarvestedUser = {
      type: freshUser.type,
      name: freshUser.name,
      lastSeenAt: freshUser.lastSeenAt,
      sourceCollections: Array.from(
        new Set([...prev.sourceCollections, ...freshUser.sourceCollections]),
      ).sort(),
    };
    out[id] = merged;
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test src/lib/bizzmine/__tests__/users.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bizzmine/users.ts src/lib/bizzmine/__tests__/users.test.ts
git commit -m "feat(bizzmine): harvest user id->name from OrgChart fields across collections"
```

---

### Task 14: Create `/api/bizzmine/collection/[code]` route

**Files:**
- Create: `src/app/api/bizzmine/collection/[code]/route.ts`

Returns normalized records for a single collection. Used by `/api/bizzmine/sync` and as a debugging entry point.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { BizzmineClient } from '@/lib/bizzmine/client';
import { COLLECTION_CODES, KNOWN_COLLECTION_CODES } from '@/lib/bizzmine/config';
import { ApiError, ConfigError, TransportError } from '@/lib/bizzmine/errors';
import { normalizeCapaInstances } from '@/lib/bizzmine/normalize/capa';
import type { RawInstance } from '@/lib/bizzmine/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { code } = await ctx.params;

  if (!KNOWN_COLLECTION_CODES.has(code)) {
    return NextResponse.json(
      { error: 'unknown_collection', code },
      { status: 404 },
    );
  }

  try {
    const raw = await BizzmineClient.get<RawInstance[]>(
      `/collection/${code}/instances`,
    );

    const normalized = code === COLLECTION_CODES.capa ? normalizeCapaInstances(raw) : raw;

    return NextResponse.json({
      code,
      count: Array.isArray(raw) ? raw.length : 0,
      normalized: code === COLLECTION_CODES.capa,
      records: normalized,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ error: 'config', message: e.message }, { status: 500 });
    }
    if (e instanceof ApiError) {
      return NextResponse.json(
        { error: 'api', status: e.status, message: `BizzMine returned ${e.status}` },
        { status: 502 },
      );
    }
    if (e instanceof TransportError) {
      return NextResponse.json(
        { error: 'transport', message: 'Network error contacting BizzMine' },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: 'unknown' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual smoke test against live API**

Run: `npm run dev`
In another terminal:

```bash
curl http://localhost:3000/api/bizzmine/collection/CAPA | jq '.count, .records[0]["Title"]'
```

Expected: a number and a CAPA title (e.g. `264` and a real title from the live data).

```bash
curl http://localhost:3000/api/bizzmine/collection/UNKNOWN_CODE
```

Expected: `{"error":"unknown_collection","code":"UNKNOWN_CODE"}` with HTTP 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bizzmine/collection/
git commit -m "feat(api): add /api/bizzmine/collection/[code] for normalized fetches"
```

---

### Task 15: Create `/api/bizzmine/users` route + Firestore persistence

**Files:**
- Create: `src/app/api/bizzmine/users/route.ts`
- Modify: `src/lib/bizzmine/users.ts` (add server-side persistence helpers)

Reads/writes the harvested `id → name` map at Firestore document `bizzmine_meta/users`. The sync route will call this after fetching all collections.

- [ ] **Step 1: Add Firestore helpers to `src/lib/bizzmine/users.ts`**

Append to the existing file:

```typescript
import { getDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const META_DOC = 'bizzmine_meta';
const USERS_DOC = 'users';

export async function loadPersistedUsers(): Promise<UsersById> {
  try {
    const db = getDb();
    const ref = doc(db, META_DOC, USERS_DOC);
    const snap = await getDoc(ref);
    if (!snap.exists()) return {};
    const data = snap.data() as { users?: UsersById };
    return data.users ?? {};
  } catch (e) {
    console.error('Failed to load persisted users:', e);
    return {};
  }
}

export async function persistUsers(users: UsersById): Promise<void> {
  const db = getDb();
  const ref = doc(db, META_DOC, USERS_DOC);
  await setDoc(ref, { users, updatedAt: new Date().toISOString() }, { merge: false });
}
```

- [ ] **Step 2: Create the route**

```typescript
// src/app/api/bizzmine/users/route.ts
import { NextResponse } from 'next/server';
import { loadPersistedUsers } from '@/lib/bizzmine/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const users = await loadPersistedUsers();
    return NextResponse.json({
      count: Object.keys(users).length,
      users,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: 'firestore',
        message: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual smoke test (Firestore should still be empty at this point)**

Run: `npm run dev`

```bash
curl http://localhost:3000/api/bizzmine/users
```

Expected: `{"count":0,"users":{}}`. (After Task 16's sync runs, this will populate.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bizzmine/users.ts src/app/api/bizzmine/users/route.ts
git commit -m "feat(bizzmine): persist harvested users to Firestore + GET /api/bizzmine/users"
```

---

### Task 16: Create `/api/bizzmine/sync` orchestration route

**Files:**
- Create: `src/app/api/bizzmine/sync/route.ts`

The headline endpoint. POST hits BizzMine for every supported collection in parallel (with a concurrency cap), normalizes, harvests users, persists user map, returns everything in one response.

For Phase 2, only CAPA is normalized. Other collections come back as raw arrays. Phase 3 adds the rest.

The route does three things in order: (1) fetch every collection in parallel with a concurrency cap, (2) harvest users from the RAW records before normalization (which would strip OrgChart fields), (3) normalize per-collection (CAPA only in Phase 2; the rest pass through raw).

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/bizzmine/sync/route.ts
import { NextResponse } from 'next/server';
import { BizzmineClient } from '@/lib/bizzmine/client';
import { COLLECTION_CODES, type CollectionKey } from '@/lib/bizzmine/config';
import { normalizeCapaInstances } from '@/lib/bizzmine/normalize/capa';
import {
  harvestUsersFromRecords,
  loadPersistedUsers,
  mergeUserMaps,
  persistUsers,
} from '@/lib/bizzmine/users';
import type { RawInstance } from '@/lib/bizzmine/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

interface SyncResultPerCollection {
  code: string;
  count: number;
  normalized: boolean;
  ok: boolean;
  error?: string;
  records?: unknown[];
}

interface FetchResult {
  key: CollectionKey;
  code: string;
  raw: RawInstance[] | null;
  error?: string;
}

const CONCURRENCY = 3;

async function fetchOne(key: CollectionKey): Promise<FetchResult> {
  const code = COLLECTION_CODES[key];
  try {
    const raw = await BizzmineClient.get<RawInstance[]>(
      `/collection/${code}/instances`,
    );
    return { key, code, raw };
  } catch (e) {
    return {
      key,
      code,
      raw: null,
      error: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
    };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    return next();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next()),
  );
  return results;
}

export async function POST() {
  const startedAt = new Date().toISOString();
  const keys = Object.keys(COLLECTION_CODES) as CollectionKey[];

  // 1. Fetch every collection in parallel (capped concurrency)
  const fetched = await runWithConcurrency(keys, fetchOne, CONCURRENCY);

  // 2. Build harvest source from RAW records (before normalization strips OrgChart)
  const harvestSource: Record<string, RawInstance[]> = {};
  for (const f of fetched) {
    if (f.raw) harvestSource[f.code] = f.raw;
  }

  // 3. Harvest + persist user map (best-effort; failures don't break sync)
  let userCount = 0;
  try {
    const previous = await loadPersistedUsers();
    const fresh = harvestUsersFromRecords(harvestSource);
    const merged = mergeUserMaps(previous, fresh);
    await persistUsers(merged);
    userCount = Object.keys(merged).length;
  } catch (e) {
    console.error('User harvest/persist failed:', e);
  }

  // 4. Normalize per-collection (only CAPA in Phase 2)
  const perCollection: SyncResultPerCollection[] = fetched.map((f) => {
    if (!f.raw) {
      return {
        code: f.code,
        count: 0,
        normalized: false,
        ok: false,
        error: f.error,
      };
    }
    if (f.key === 'capa') {
      return {
        code: f.code,
        count: f.raw.length,
        normalized: true,
        ok: true,
        records: normalizeCapaInstances(f.raw),
      };
    }
    return {
      code: f.code,
      count: f.raw.length,
      normalized: false,
      ok: true,
      records: f.raw,
    };
  });

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    startedAt,
    collections: perCollection,
    userCount,
  });
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
In another terminal:

```bash
curl -X POST http://localhost:3000/api/bizzmine/sync | jq '.collections[] | {code, count, normalized, ok}'
```

Expected: 9 entries, all `ok: true`, with realistic counts (CAPA ~264, BR ~83, etc.). Only CAPA shows `normalized: true`.

```bash
curl http://localhost:3000/api/bizzmine/users | jq '.count'
```

Expected: a number > 0 (count of users harvested across all collections).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bizzmine/sync/route.ts
git commit -m "feat(api): add /api/bizzmine/sync orchestration with user harvest"
```

---

### Task 17: Extend DataContext with sync() and lastSyncedAt

**Files:**
- Modify: `src/contexts/data-context.tsx`

Adds three pieces:
1. `lastSyncedAt: Date | null` — when the last sync completed
2. `syncStatus: 'idle' | 'syncing' | 'error'` — for the UI
3. `sync(): Promise<void>` — calls `/api/bizzmine/sync`, dispatches each collection's records into the existing per-collection setters

- [ ] **Step 1: Replace the file with the extended version**

```typescript
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { MetricSnapshot } from '@/lib/types';

interface CapaData { [key: string]: any; }
interface ChangeActionData { [key: string]: any; }
interface NonConformanceData { [key: string]: any; }
interface TrainingData { [key: string]: any; }
interface BatchReleaseData { [key: string]: any; }
interface DocumentKpiData { [key: string]: any; }
interface ChangeKpiData { [key: string]: any; }

type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncCollectionResult {
  code: string;
  count: number;
  normalized: boolean;
  ok: boolean;
  error?: string;
  records?: any[];
}

interface SyncResponse {
  syncedAt: string;
  startedAt: string;
  collections: SyncCollectionResult[];
  userCount: number;
}

const COLLECTION_TO_SETTER_KEY: Record<string, string> = {
  CAPA: 'capa',
  NC: 'nc',
  Change_Actions: 'changeActions',
  CM: 'changes',
  KPI_batch_release: 'batchRelease',
  BR: 'batchRegistry',
  DC: 'documents',
  A004: 'training',
  A007: 'introTraining',
};

interface DataContextType {
  capaData: CapaData[];
  changeActionData: ChangeActionData[];
  nonConformanceData: NonConformanceData[];
  trainingData: TrainingData[];
  batchReleaseData: BatchReleaseData[];
  documentKpiData: DocumentKpiData[];
  changeKpiData: ChangeKpiData[];
  snapshots: MetricSnapshot[];
  setCapaData: React.Dispatch<React.SetStateAction<CapaData[]>>;
  setChangeActionData: React.Dispatch<React.SetStateAction<ChangeActionData[]>>;
  setNonConformanceData: React.Dispatch<React.SetStateAction<NonConformanceData[]>>;
  setTrainingData: React.Dispatch<React.SetStateAction<TrainingData[]>>;
  setBatchReleaseData: React.Dispatch<React.SetStateAction<BatchReleaseData[]>>;
  setDocumentKpiData: React.Dispatch<React.SetStateAction<DocumentKpiData[]>>;
  setChangeKpiData: React.Dispatch<React.SetStateAction<ChangeKpiData[]>>;
  saveSnapshot: (metrics: MetricSnapshot['metrics']) => Promise<void>;
  refreshSnapshots: () => Promise<void>;
  // NEW: sync from BizzMine
  lastSyncedAt: Date | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  hasEverSynced: boolean;
  sync: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const LAST_SYNCED_LS_KEY = 'bizzmine.lastSyncedAt';

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [capaData, setCapaData] = useState<CapaData[]>([]);
  const [changeActionData, setChangeActionData] = useState<ChangeActionData[]>([]);
  const [nonConformanceData, setNonConformanceData] = useState<NonConformanceData[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [batchReleaseData, setBatchReleaseData] = useState<BatchReleaseData[]>([]);
  const [documentKpiData, setDocumentKpiData] = useState<DocumentKpiData[]>([]);
  const [changeKpiData, setChangeKpiData] = useState<ChangeKpiData[]>([]);
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasEverSynced, setHasEverSynced] = useState(false);

  const fetchSnapshots = async () => {
    try {
      const { getDb } = await import('@/lib/firebase');
      const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
      const db = getDb();
      const q = query(collection(db, 'biweekly_snapshots'), orderBy('timestamp', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const fetchedSnapshots: MetricSnapshot[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedSnapshots.push({
          id: doc.id,
          timestamp: data.timestamp,
          metrics: data.metrics,
        });
      });
      setSnapshots(fetchedSnapshots);
    } catch (error) {
      console.error("Error fetching snapshots:", error);
    }
  };

  useEffect(() => {
    fetchSnapshots();
    // Restore lastSyncedAt from localStorage
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(LAST_SYNCED_LS_KEY);
      if (stored) {
        const d = new Date(stored);
        if (!isNaN(d.getTime())) {
          setLastSyncedAt(d);
          setHasEverSynced(true);
        }
      }
    }
  }, []);

  const saveSnapshot = async (metrics: MetricSnapshot['metrics']) => {
    const timeoutMs = 15000;
    try {
      const { getDb } = await import('@/lib/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = getDb();
      const savePromise = addDoc(collection(db, 'biweekly_snapshots'), {
        timestamp: serverTimestamp(),
        metrics
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          `Firestore addDoc timed out after ${timeoutMs / 1000}s. ` +
          `Check that your Firestore database exists and is named "(default)". ` +
          `Project: ${db.app.options.projectId}`
        )), timeoutMs)
      );
      await Promise.race([savePromise, timeoutPromise]);
      await fetchSnapshots();
    } catch (error) {
      console.error("Error saving snapshot:", error);
      throw error;
    }
  };

  const sync = useCallback(async () => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const r = await fetch('/api/bizzmine/sync', { method: 'POST' });
      if (!r.ok) {
        throw new Error(`Sync HTTP ${r.status}`);
      }
      const data: SyncResponse = await r.json();

      // Dispatch each collection's records into the appropriate setter
      for (const c of data.collections) {
        if (!c.ok || !c.records) continue;
        const setterKey = COLLECTION_TO_SETTER_KEY[c.code];
        switch (setterKey) {
          case 'capa': setCapaData(c.records); break;
          case 'nc': setNonConformanceData(c.records); break;
          case 'changeActions': setChangeActionData(c.records); break;
          case 'changes': setChangeKpiData(c.records); break;
          case 'batchRelease': setBatchReleaseData(c.records); break;
          case 'documents': setDocumentKpiData(c.records); break;
          case 'training':
          case 'introTraining':
            // Phase 3 will merge A004 + A007. For Phase 2, A004 wins.
            if (setterKey === 'training') setTrainingData(c.records);
            break;
          // batchRegistry has no existing setter — Phase 3 introduces a new state slot
          default: break;
        }
      }

      const synced = new Date(data.syncedAt);
      setLastSyncedAt(synced);
      setHasEverSynced(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_SYNCED_LS_KEY, synced.toISOString());
      }
      setSyncStatus('idle');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : 'Unknown sync error');
    }
  }, []);

  return (
    <DataContext.Provider value={{
      capaData,
      changeActionData,
      nonConformanceData,
      trainingData,
      batchReleaseData,
      documentKpiData,
      changeKpiData,
      snapshots,
      setCapaData,
      setChangeActionData,
      setNonConformanceData,
      setTrainingData,
      setBatchReleaseData,
      setDocumentKpiData,
      setChangeKpiData,
      saveSnapshot,
      refreshSnapshots: fetchSnapshots,
      lastSyncedAt,
      syncStatus,
      syncError,
      hasEverSynced,
      sync,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/data-context.tsx
git commit -m "feat(data-context): add sync(), lastSyncedAt, syncStatus, hasEverSynced"
```

---

### Task 18: Sync Now button component

**Files:**
- Create: `src/components/sync-now-button.tsx`

Compact button + relative-time indicator. Goes in the page header (replacing the upload button there).

- [ ] **Step 1: Create the component**

```typescript
"use client";

import React, { useEffect, useState } from 'react';
import { useData } from '@/contexts/data-context';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function formatRelative(date: Date | null): string {
  if (!date) return 'never';
  const ms = Date.now() - date.getTime();
  if (ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function SyncNowButton() {
  const { sync, syncStatus, syncError, lastSyncedAt } = useData();
  const { toast } = useToast();
  const [, setTick] = useState(0);

  // Keep the relative-time indicator fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (syncStatus === 'error' && syncError) {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: syncError,
      });
    } else if (syncStatus === 'idle' && lastSyncedAt) {
      // Don't toast on every render; only show on completion via state change
    }
  }, [syncStatus, syncError, lastSyncedAt, toast]);

  const onClick = async () => {
    await sync();
  };

  return (
    <div className="flex items-center gap-3 ml-auto">
      <span className="text-xs text-muted-foreground hidden sm:inline">
        Last sync:{' '}
        <span className="font-medium text-foreground">
          {formatRelative(lastSyncedAt)}
        </span>
      </span>
      <Button
        onClick={onClick}
        disabled={syncStatus === 'syncing'}
        size="sm"
        className="gap-2"
      >
        {syncStatus === 'syncing' && (
          <RefreshCw className="h-4 w-4 animate-spin" />
        )}
        {syncStatus === 'idle' && lastSyncedAt && (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {syncStatus === 'idle' && !lastSyncedAt && (
          <RefreshCw className="h-4 w-4" />
        )}
        {syncStatus === 'error' && (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        )}
        <span className={cn(syncStatus === 'syncing' && 'animate-pulse')}>
          {syncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
        </span>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sync-now-button.tsx
git commit -m "feat: add SyncNowButton with relative-time indicator"
```

---

### Task 19: Empty state component

**Files:**
- Create: `src/components/bizzmine-empty-state.tsx`

Shown on every dashboard tab when `hasEverSynced === false`. A friendly prompt to sync.

- [ ] **Step 1: Create the component**

```typescript
"use client";

import React from 'react';
import { useData } from '@/contexts/data-context';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

interface Props {
  /** Optional title — defaults to a generic message. */
  title?: string;
  /** Optional description override. */
  description?: string;
}

export function BizzmineEmptyState({
  title = 'No data loaded yet',
  description = 'Click Sync Now to fetch the latest data from BizzMine. This may take 10–30 seconds on the first sync.',
}: Props) {
  const { sync, syncStatus } = useData();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <GlassCard className="max-w-md w-full p-8 text-center">
        <Database className="h-12 w-12 mx-auto text-primary mb-4" />
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <Button
          onClick={sync}
          disabled={syncStatus === 'syncing'}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
          />
          {syncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
        </Button>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bizzmine-empty-state.tsx
git commit -m "feat: add BizzmineEmptyState shown until first sync"
```

---

### Task 20: Wire SyncNowButton into header; show empty state until first sync

**Files:**
- Modify: `src/app/page.tsx`

Replace `<MultiUploader />` in the header with `<SyncNowButton />`. Wrap dashboard tab contents so they show `<BizzmineEmptyState />` until `hasEverSynced` is true. Move `<MultiUploader />` into Settings (deferred to a later Phase 5 plan — for now, just remove from header; CSV uploads can still happen via the existing MultiUploader if mounted, but it's not visible anywhere yet, which is intentional during Phase 2).

- [ ] **Step 1: Replace `src/app/page.tsx`**

```typescript
"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CapaDashboard from '@/components/capa-dashboard';
import ChangesDashboard from "@/components/changes-dashboard";
import ChangeActionDashboard from "@/components/change-action-dashboard";
import NonConformanceDashboard from "@/components/non-conformance-dashboard";
import TrainingDashboard from "@/components/training-dashboard";
import BatchReleaseDashboard from "@/components/batch-release-dashboard";
import CompendiumDashboard from "@/components/compendium-dashboard";
import SettingsPage from "@/components/settings-page";
import DocumentsInFlowDashboard from "@/components/documents-in-flow-dashboard";
import { SyncNowButton } from "@/components/sync-now-button";
import { BizzmineEmptyState } from "@/components/bizzmine-empty-state";
import { useData } from "@/contexts/data-context";
import Image from 'next/image';

function DashboardSlot({ children }: { children: React.ReactNode }) {
  const { hasEverSynced } = useData();
  if (!hasEverSynced) return <BizzmineEmptyState />;
  return <>{children}</>;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-10 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Company Logo" width={120} height={120} />
            <h1 className="text-xl font-semibold tracking-tight text-primary">KPI Insights</h1>
          </div>
          <SyncNowButton />
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Total Overview</TabsTrigger>
              <TabsTrigger value="batch-release">Batch Release</TabsTrigger>
              <TabsTrigger value="capa">CAPA</TabsTrigger>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="change-action">Change Action</TabsTrigger>
              <TabsTrigger value="documents-in-flow">Documents in Flow</TabsTrigger>
              <TabsTrigger value="non-conformance">Non-conformance</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <DashboardSlot><CompendiumDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="batch-release">
              <DashboardSlot><BatchReleaseDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="capa">
              <DashboardSlot><CapaDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="changes">
              <DashboardSlot><ChangesDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="change-action">
              <DashboardSlot><ChangeActionDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="documents-in-flow">
              <DashboardSlot><DocumentsInFlowDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="non-conformance">
              <DashboardSlot><NonConformanceDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="training">
              <DashboardSlot><TrainingDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="settings">
              <SettingsPage />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </main>
  );
}
```

Note: `Settings` does NOT get wrapped — it must always be reachable so the user can run "Test Connection" before the first sync.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace upload button with SyncNowButton; show empty state until first sync"
```

---

### Task 21: End-to-end manual verification

This is the final acceptance gate for Phase 1+2. The agent must NOT mark the plan complete until every check below passes against the running app.

- [ ] **Step 1: Start with a clean dev server**

```bash
npm run dev
```

Open http://localhost:3000 in a browser.

- [ ] **Step 2: Verify empty state on first load**

- Total Overview tab: shows "No data loaded yet" empty state with Sync Now button
- CAPA tab: shows the same empty state
- Settings tab: shows BizzMine Connection panel + Appearance + Team Management

- [ ] **Step 3: Test connectivity from Settings**

In Settings, click "Test Connection".
Expected: green checkmark with "Connected — BizzMine v6.0.44.5".

- [ ] **Step 4: First sync**

Click "Sync Now" in the header (or in the empty state).
Expected:
- Button shows "Syncing…" with spinner
- After 5–30 seconds, button returns to "Sync Now" with green checkmark
- "Last sync: just now" appears in header
- All tabs (Total Overview, CAPA, etc.) now render their dashboards instead of empty state

- [ ] **Step 5: CAPA parity check**

On the CAPA tab:
- Record count should match prior CSV-export expectation (~264)
- Spot-check a known record by Title — same data as a recent CSV upload
- Click into a CAPA detail — fields populate (Title, Assigned To, Due Date, Pending Steps, etc.)
- Charts render
- Date filters work

If any field is empty that shouldn't be, check the normalizer — likely a BookmarkName mismatch.

- [ ] **Step 6: Other tabs (raw passthrough)**

NC, Change Actions, etc. tabs render — but the field-shape mismatch from un-normalized records means many displays will be wrong. **This is expected for Phase 2.** Phase 3 adds normalizers for these. The acceptance criterion is that they don't crash.

- [ ] **Step 7: User map populated**

```bash
curl http://localhost:3000/api/bizzmine/users | jq '.count'
```

Expected: a number > 50 (covers all active users in the tenant).

- [ ] **Step 8: Persistent lastSyncedAt across refresh**

Refresh the page in the browser. The header should still show "Last sync: <time> ago" — the value is cached in localStorage.

- [ ] **Step 9: typecheck and tests pass**

```bash
npm run typecheck
npm test
```

Expected: no TS errors; all tests pass (sanity + client + normalize-generic + normalize-capa + users).

- [ ] **Step 10: Commit a final marker**

```bash
git commit --allow-empty -m "chore: Phase 1+2 BizzMine API integration verified end-to-end"
```

---

## Self-review checklist

The plan author runs this after writing the plan; the executing agent runs this after the last task. Each item must be answered with a concrete reference.

**Spec coverage:**

| Spec section | Implemented in task | Notes |
|---|---|---|
| §2.4 user-name harvesting | T13, T15, T16 | Persisted via `bizzmine_meta/users` |
| §2.5–2.6 BR upstream/downstream | DEFERRED to Phase 3 plan | Out of scope here |
| §3 snapshot-free architecture | DEFERRED to Phase 4.1 plan | Requires Phase 3 data |
| §4.1 module layout | T3–T8, T9, T14–T16 | Matches §4.1 of spec |
| §4.2 data flow | T16, T17 | sync() → setters per-collection |
| §4.3 manual sync only, lastSyncedAt | T17, T18 | localStorage persistence |
| §5 Phase 1 — Foundation | T1–T11 | All 7 sub-bullets covered |
| §5 Phase 2 — CAPA pilot | T12–T21 | Side-by-side validation: T21 §5 |
| §6 security recipe | T2, T3 (server-only), T6 (no token in errors) | RUNTIME-only secret binding confirmed |
| §11 final decisions: empty until sync | T19, T20 | DashboardSlot wrapper |
| §11 final decisions: 1 global sync button | T16, T18 | Single endpoint, single button |

**Placeholder scan:** No "TODO", "TBD", "fill in later", "similar to", or "appropriate" hand-waves. Every code block is complete and runnable.

**Type consistency:** `BizzmineClient.get`, `BizzmineClient.post` — same signature throughout. `normalizeCapaRecord` and `normalizeCapaInstances` consistent. `harvestUsersFromRecords` and `mergeUserMaps` consistent. `UsersById` defined in `types.ts`, used in `users.ts` and the API route.

**Scope check:** This plan covers Phase 1 + Phase 2 only. Phase 3 (8 more normalizers) and Phase 4 (10 capability sub-features) are explicitly deferred and called out in the header. End state ships a working, deployable slice.
