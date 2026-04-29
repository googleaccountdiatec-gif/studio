import { describe, it, expect } from 'vitest';
import { resolveStepName, type StepMap } from '../steps';

const sampleMap: StepMap = new Map([
  [32, 'Start'],
  [1413, 'CAPA Execution'],
  [1414, 'CAPA Effectiveness Evaluation'],
  [1253, 'CAPA Effectiveness Evaluation'],
  [499, 'CAPA Effectiveness Evaluation'],
]);

describe('resolveStepName', () => {
  it('resolves a numeric ID to its step name', () => {
    expect(resolveStepName(1413, sampleMap)).toBe('CAPA Execution');
    expect(resolveStepName(1414, sampleMap)).toBe('CAPA Effectiveness Evaluation');
  });

  it('resolves a numeric-string ID (BizzMine returns string sometimes)', () => {
    expect(resolveStepName('1413', sampleMap)).toBe('CAPA Execution');
  });

  it('passes through a non-numeric string (legacy CSV had names)', () => {
    expect(resolveStepName('CAPA Execution', sampleMap)).toBe('CAPA Execution');
    expect(resolveStepName('Some New Step', sampleMap)).toBe('Some New Step');
  });

  it('returns empty string for empty / undefined / unknown ID', () => {
    expect(resolveStepName('', sampleMap)).toBe('');
    expect(resolveStepName(undefined, sampleMap)).toBe('');
    expect(resolveStepName(null, sampleMap)).toBe('');
    expect(resolveStepName(99999, sampleMap)).toBe(''); // not in map
  });

  it('handles a numeric-float input (BizzMine often returns 1413.0)', () => {
    expect(resolveStepName(1413.0, sampleMap)).toBe('CAPA Execution');
  });
});
