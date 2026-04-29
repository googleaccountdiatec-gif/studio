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
