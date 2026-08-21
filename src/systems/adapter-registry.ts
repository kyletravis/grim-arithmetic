import { Pf2eAdapter } from './pf2e-adapter';

/** Game systems Grim Arithmetic has an adapter for. */
export const SUPPORTED_SYSTEMS = ['pf2e'] as const;

/**
 * Resolves the active game system to its adapter, or null when unsupported.
 * Defaults to the live `game.system.id` so callers can omit the argument;
 * tests (and non-Foundry contexts) pass an explicit systemId instead.
 */
export function getSystemAdapter(
  systemId: string | undefined = typeof game === 'undefined' ? undefined : game.system?.id
): Pf2eAdapter | null {
  return systemId === 'pf2e' ? new Pf2eAdapter() : null;
}
