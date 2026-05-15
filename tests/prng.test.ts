import { describe, expect, it } from 'vitest';
import { createRng, deriveChildSeed } from '../src/engine/prng';

describe('createRng', () => {
  it('produces identical sequences for identical numeric seeds', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i += 1) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces diverging sequences for different numeric seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    let differences = 0;
    for (let i = 0; i < 100; i += 1) {
      if (a.next() !== b.next()) differences += 1;
    }
    expect(differences).toBeGreaterThan(80);
  });

  it('produces identical sequences for identical string seeds', () => {
    const a = createRng('mira-vs-troll');
    const b = createRng('mira-vs-troll');
    for (let i = 0; i < 50; i += 1) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('hashes different string seeds to different streams', () => {
    const a = createRng('alpha');
    const b = createRng('beta');
    let differences = 0;
    for (let i = 0; i < 100; i += 1) {
      if (a.next() !== b.next()) differences += 1;
    }
    expect(differences).toBeGreaterThan(80);
  });

  it('next() returns values in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 10000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('nextInt is bounded and covers both endpoints', () => {
    const rng = createRng(7);
    const counts = new Map<number, number>();
    for (let i = 0; i < 10000; i += 1) {
      const value = rng.nextInt(1, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    expect(counts.get(1)).toBeGreaterThan(0);
    expect(counts.get(6)).toBeGreaterThan(0);
  });

  it('nextInt with min === max always returns that value', () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i += 1) {
      expect(rng.nextInt(5, 5)).toBe(5);
    }
  });

  it('nextInt rejects non-integer bounds', () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(1.5, 6)).toThrow(/must be integers/);
  });

  it('nextInt rejects inverted bounds', () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(6, 1)).toThrow(/must be <= max/);
  });

  it('rejects non-finite numeric seeds', () => {
    expect(() => createRng(Number.NaN)).toThrow(/must be finite/);
    expect(() => createRng(Number.POSITIVE_INFINITY)).toThrow(/must be finite/);
  });

  it('string and numeric seeds are independent', () => {
    const a = createRng('123');
    const b = createRng(123);
    let differences = 0;
    for (let i = 0; i < 50; i += 1) {
      if (a.next() !== b.next()) differences += 1;
    }
    expect(differences).toBeGreaterThan(0);
  });
});

describe('deriveChildSeed', () => {
  it('is deterministic for the same parent + label', () => {
    expect(deriveChildSeed(42, 0)).toBe(deriveChildSeed(42, 0));
    expect(deriveChildSeed('mira', 'iter-1')).toBe(deriveChildSeed('mira', 'iter-1'));
  });

  it('returns different child seeds for different labels', () => {
    expect(deriveChildSeed(42, 0)).not.toBe(deriveChildSeed(42, 1));
  });

  it('returns different child seeds for different parents', () => {
    expect(deriveChildSeed(42, 'x')).not.toBe(deriveChildSeed(43, 'x'));
  });

  it('produces seeds usable by createRng', () => {
    const childSeed = deriveChildSeed('campaign', 7);
    const rng = createRng(childSeed);
    expect(rng.next()).toBeGreaterThanOrEqual(0);
    expect(rng.next()).toBeLessThan(1);
  });
});
