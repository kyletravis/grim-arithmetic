import { describe, expect, it } from 'vitest';
import {
  asRecord,
  getActorItems,
  isRecord,
  optionalNumberLike,
  toStringArray
} from '../src/systems/record-utils';

describe('record-utils', () => {
  it('isRecord / asRecord', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(asRecord('x')).toEqual({});
  });
  it('optionalNumberLike parses "+7" and rejects junk', () => {
    expect(optionalNumberLike('+7')).toBe(7);
    expect(optionalNumberLike(' 3 ')).toBe(3);
    expect(optionalNumberLike('abc')).toBeUndefined();
    expect(optionalNumberLike(NaN)).toBeUndefined();
  });
  it('toStringArray accepts strings, {slug}, and {name}', () => {
    expect(toStringArray(['agile', { slug: 'finesse' }, { name: 'deadly-d10' }, 3])).toEqual([
      'agile',
      'finesse',
      'deadly-d10'
    ]);
  });
  it('getActorItems handles arrays, {contents}, and filter-capable collections', () => {
    const a = [{ id: 'a' }];
    expect(getActorItems(a)).toEqual(a);
    expect(getActorItems({ contents: a })).toEqual(a);
    expect(getActorItems({ filter: (p: (x: unknown) => boolean) => a.filter(p) })).toEqual(a);
    expect(getActorItems(undefined)).toEqual([]);
  });
});
