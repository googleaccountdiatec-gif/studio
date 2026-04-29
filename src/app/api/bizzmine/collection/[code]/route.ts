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
