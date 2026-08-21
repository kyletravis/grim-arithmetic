/**
 * Lengthen Foundry's tooltip delay only while the pointer is inside a Grim
 * Arithmetic window (KHT-120), restoring the core default the moment it
 * leaves. Foundry reads TOOLTIP_ACTIVATION_MS off the manager class at hover
 * time, so toggling the static on pointerover is enough. Never touches the
 * delay for players or other modules' UI.
 */
export function nextTooltipDelayState(
  inside: boolean,
  active: boolean
): 'enter' | 'leave' | 'none' {
  if (inside && !active) return 'enter';
  if (!inside && active) return 'leave';
  return 'none';
}

export function installScopedTooltipDelay(ms: number, selector = '.grim-arithmetic-window'): void {
  if (typeof game === 'undefined' || typeof document === 'undefined') return;
  const managerClass = game.tooltip?.constructor;
  if (!managerClass) return;
  const original = managerClass.TOOLTIP_ACTIVATION_MS;
  let active = false;
  document.addEventListener('pointerover', (event) => {
    const target = event.target;
    const inside = target instanceof Element && target.closest(selector) !== null;
    const transition = nextTooltipDelayState(inside, active);
    if (transition === 'enter') {
      active = true;
      managerClass.TOOLTIP_ACTIVATION_MS = ms;
    }
    if (transition === 'leave') {
      active = false;
      managerClass.TOOLTIP_ACTIVATION_MS = original;
    }
  });
}
