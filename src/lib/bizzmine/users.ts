import type { HarvestedUser, OrgChartEntry, RawInstance, UsersById } from './types';
import { getDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
