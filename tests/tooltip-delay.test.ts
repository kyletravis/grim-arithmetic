import { describe, expect, it } from 'vitest';
import { installScopedTooltipDelay, nextTooltipDelayState } from '../src/ui/tooltip-delay';

describe('scoped tooltip delay', () => {
  it('state machine: apply on enter, restore on leave, otherwise no-op', () => {
    expect(nextTooltipDelayState(true, false)).toBe('enter');
    expect(nextTooltipDelayState(true, true)).toBe('none');
    expect(nextTooltipDelayState(false, true)).toBe('leave');
    expect(nextTooltipDelayState(false, false)).toBe('none');
  });
  it('installScopedTooltipDelay is a no-op outside Foundry', () => {
    expect(() => installScopedTooltipDelay(750)).not.toThrow();
  });
});
