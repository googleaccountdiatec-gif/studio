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
