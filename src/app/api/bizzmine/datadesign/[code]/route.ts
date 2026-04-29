import { NextRequest, NextResponse } from 'next/server';
import { BizzmineClient } from '@/lib/bizzmine/client';
import { KNOWN_COLLECTION_CODES } from '@/lib/bizzmine/config';
import { ApiError, ConfigError, TransportError } from '@/lib/bizzmine/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/bizzmine/datadesign/[code]
 *
 * Returns the BizzMine collection schema (CollectionFields + LinkedCollections)
 * for a known collection code. Used during Phase 3 normalizer development to
 * discover the BookmarkName -> CSV-header mapping for each collection without
 * exposing the API token in client-side curl commands.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { code } = await ctx.params;

  if (!KNOWN_COLLECTION_CODES.has(code)) {
    return NextResponse.json(
      { error: 'unknown_collection', code },
      { status: 404 },
    );
  }

  try {
    const design = await BizzmineClient.get(`/collection/${code}/datadesign`);
    return NextResponse.json(design);
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
