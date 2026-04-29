import {
  unwrapCombobox,
  flattenOrgChart,
  toIntOrEmpty,
  toIsoDate,
} from './index';
import type { RawInstance, SubCollectionEntry } from '../types';

/**
 * Merged Training output shape — A004 (regular) and A007 (introduction)
 * normalize to the same record shape so the Training tab can show both
 * with a category filter (per user decision: fold A007 into Training tab).
 *
 * Output keys match the existing training-dashboard.tsx TrainingData interface.
 */
export interface NormalizedTraining {
  'Record training ID': string;
  'Title': string;
  'Trainee': string;
  'Training category': 'Regular' | 'Introduction';
  'Deadline for completing training': string;
  'Final training approval': string;
  'Pending Steps': string;
  'Completed On': string;
  'Registration Time': string;
  'Position': string;
  'Supervisor': string;
  _subCollections: Record<string, SubCollectionEntry[]>;
  [key: string]: unknown;
}

function firstOf<T = RawInstance>(raw: unknown): T | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw[0] as T;
}

function deriveA004Title(raw: RawInstance): string {
  const tm = firstOf(raw.Trainingmodules);
  const subTitle = tm?.Trainingmodules_Title;
  if (typeof subTitle === 'string' && subTitle.trim()) return subTitle;
  if (typeof raw.A004_Position === 'string' && raw.A004_Position.trim()) {
    return raw.A004_Position;
  }
  return 'Training';
}

function deriveA007Title(raw: RawInstance): string {
  const m = firstOf(raw.Modules);
  const subTitle = m?.Modules_Title;
  if (typeof subTitle === 'string' && subTitle.trim()) return subTitle;
  if (typeof raw.A007_Position === 'string' && raw.A007_Position.trim()) {
    return raw.A007_Position;
  }
  return 'Introduction Training';
}

export function normalizeA004Record(raw: RawInstance): NormalizedTraining {
  const subs: Record<string, SubCollectionEntry[]> = {};
  if (Array.isArray(raw.Trainingmodules)) {
    subs.Trainingmodules = raw.Trainingmodules as SubCollectionEntry[];
  }

  const idOrEmpty = toIntOrEmpty(raw.A004_A004ID);

  return {
    'Record training ID': idOrEmpty === '' ? 'A004-' : `A004-${idOrEmpty}`,
    'Title': deriveA004Title(raw),
    'Trainee': flattenOrgChart(raw.A004_Trainee),
    'Training category': 'Regular',
    'Deadline for completing training': toIsoDate(raw.A004_Deadlineforcompletingtraining),
    'Final training approval': unwrapCombobox(raw.A004_Finaltrainingapproval),
    'Pending Steps': typeof raw.A004_PendingSteps === 'string' ? raw.A004_PendingSteps : '',
    'Completed On': toIsoDate(raw.A004_CompletedOn),
    'Registration Time': toIsoDate(raw.A004_RegistrationTime),
    'Position': typeof raw.A004_Position === 'string' ? raw.A004_Position : '',
    'Supervisor': flattenOrgChart(raw.A004_Supervisor),
    _subCollections: subs,
  };
}

export function normalizeA007Record(raw: RawInstance): NormalizedTraining {
  const subs: Record<string, SubCollectionEntry[]> = {};
  if (Array.isArray(raw.Modules)) {
    subs.Modules = raw.Modules as SubCollectionEntry[];
  }

  const idOrEmpty = toIntOrEmpty(raw.A007_A007ID);

  return {
    'Record training ID': idOrEmpty === '' ? 'A007-' : `A007-${idOrEmpty}`,
    'Title': deriveA007Title(raw),
    'Trainee': flattenOrgChart(raw.A007_Trainee),
    'Training category': 'Introduction',
    'Deadline for completing training': toIsoDate(raw.A007_Deadlinefortrainingexecution),
    'Final training approval': toIsoDate(raw.A007_Trainingapproval),
    'Pending Steps': typeof raw.A007_PendingSteps === 'string' ? raw.A007_PendingSteps : '',
    'Completed On': toIsoDate(raw.A007_CompletedOn),
    'Registration Time': toIsoDate(raw.A007_RegistrationTime),
    'Position': typeof raw.A007_Position === 'string' ? raw.A007_Position : '',
    'Supervisor': flattenOrgChart(raw.A007_Supervisor),
    _subCollections: subs,
  };
}

/**
 * Merge A004 and A007 instance arrays into one normalized stream.
 * Order: A004 records first, then A007 — preserves stable iteration order
 * for the dashboard's grouping/sorting logic.
 */
export function normalizeTrainingInstances(
  a004Raws: RawInstance[],
  a007Raws: RawInstance[],
): NormalizedTraining[] {
  return [
    ...a004Raws.map(normalizeA004Record),
    ...a007Raws.map(normalizeA007Record),
  ];
}
