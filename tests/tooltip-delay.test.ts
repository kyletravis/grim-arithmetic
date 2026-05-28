import { afterEach, describe, expect, it } from 'vitest';
import { applyTooltipDelay } from '../src/ui/tooltip-delay';

afterEach(() => {
  delete (globalThis as { game?: unknown }).game;
});

describe('applyTooltipDelay (KHT-120)', () => {
  it('sets TOOLTIP_ACTIVATION_MS on the live tooltip manager class', () => {
    const fakeClass: { TOOLTIP_ACTIVATION_MS?: number } = {};
    (globalThis as { game?: unknown }).game = { tooltip: { constructor: fakeClass } };
    applyTooltipDelay(750);
    expect(fakeClass.TOOLTIP_ACTIVATION_MS).toBe(750);
  });

  it('does nothing and does not throw when no tooltip manager exists', () => {
    expect(() => applyTooltipDelay(750)).not.toThrow();
  });

  it('does nothing when game exists but tooltip manager is absent', () => {
    (globalThis as { game?: unknown }).game = {};
    expect(() => applyTooltipDelay(750)).not.toThrow();
  });
});
