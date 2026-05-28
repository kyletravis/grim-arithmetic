/**
 * Lengthen the delay before Foundry's native `data-tooltip` help appears,
 * so tooltips don't fire continuously while scanning down a list of values
 * (KHT-120). Foundry reads `TOOLTIP_ACTIVATION_MS` off the tooltip manager
 * class at hover time, so overriding it affects all subsequent hovers.
 *
 * `game.tooltip.constructor` is the live class regardless of v13+ namespace
 * relocation. No-ops safely when the manager is unavailable (pre-ready, or
 * the test environment where `game` is undefined).
 */
export function applyTooltipDelay(ms: number): void {
  if (typeof game === 'undefined') return;
  try {
    const manager = (game as { tooltip?: { constructor?: { TOOLTIP_ACTIVATION_MS?: number } } }).tooltip;
    const managerClass = manager?.constructor;
    if (managerClass) managerClass.TOOLTIP_ACTIVATION_MS = ms;
  } catch {
    /* tooltip manager unavailable; leave the default delay in place */
  }
}
