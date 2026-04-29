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
