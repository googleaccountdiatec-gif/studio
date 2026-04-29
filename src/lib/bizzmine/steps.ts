import 'server-only';
import { BizzmineClient } from './client';

interface RawStep {
  StepsName: string;
  StepsID: number;
}

/**
 * Map of BizzMine StepsID -> StepsName for one collection's workflow.
 *
 * The API returns numeric step IDs in `*_PendingSteps` fields; this map
 * resolves them to the human-readable step name for display and for
 * collection-specific phase classification.
 */
export type StepMap = Map<number, string>;

/**
 * Fetch the full step-version list for a collection and return as a Map.
 * One call per collection per sync. The endpoint returns ALL step versions
 * ever published (typically 50–200 entries), not just the current workflow.
 */
export async function fetchStepMap(code: string): Promise<StepMap> {
  const steps = await BizzmineClient.get<RawStep[]>(`/collection/${code}/steps`);
  const map: StepMap = new Map();
  for (const s of steps) {
    if (typeof s?.StepsID === 'number' && typeof s?.StepsName === 'string') {
      map.set(s.StepsID, s.StepsName);
    }
  }
  return map;
}

/**
 * Resolve a `Pending Steps` value (which BizzMine returns as a numeric step ID
 * but legacy CSV exports contain as a step name) to a human-readable step name.
 *
 * - number / numeric string -> map lookup
 * - non-numeric string -> passthrough (legacy CSV / future API shape change)
 * - empty / unknown -> empty string
 */
export function resolveStepName(input: unknown, stepMap: StepMap): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input === 'number') {
    return stepMap.get(Math.trunc(input)) ?? '';
  }
  if (typeof input === 'string') {
    const asNum = Number(input);
    if (Number.isFinite(asNum) && stepMap.has(Math.trunc(asNum))) {
      return stepMap.get(Math.trunc(asNum))!;
    }
    return input; // already a name
  }
  return '';
}
