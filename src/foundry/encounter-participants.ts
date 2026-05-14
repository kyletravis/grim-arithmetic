import { CombatantSnapshot, SystemAdapter } from '../systems/base-adapter';

export interface EncounterParticipant<TokenLike> {
  token: TokenLike;
  snapshot: CombatantSnapshot;
}

export interface EncounterSourceCombatant<TokenLike> {
  token?: TokenLike;
}

export interface EncounterSource<TokenLike> {
  combatants?: Iterable<EncounterSourceCombatant<TokenLike>>;
  sceneTokens?: Iterable<TokenLike>;
}

export interface EncounterParticipants<TokenLike> {
  pcs: EncounterParticipant<TokenLike>[];
  hostiles: EncounterParticipant<TokenLike>[];
  unsupported: string[];
  caveats: string[];
}

export interface ResolveOptions {
  allowSceneFallback?: boolean;
}

const UNKNOWN_NAME = 'Unknown actor';
const SCENE_FALLBACK_CAVEAT =
  'No active combat encounter — using scene tokens as a best-effort fallback.';
const NO_COMBAT_CAVEAT = 'No active combat encounter.';

export function resolveEncounterParticipants<TokenLike extends { name?: string }>(
  source: EncounterSource<TokenLike>,
  adapter: SystemAdapter<TokenLike>,
  options: ResolveOptions = {}
): EncounterParticipants<TokenLike> {
  const combatants = source.combatants ? Array.from(source.combatants) : [];

  if (combatants.length > 0) {
    return classifyTokens(combatants.map((c) => c.token), adapter, []);
  }

  if (options.allowSceneFallback && source.sceneTokens) {
    const sceneTokens = Array.from(source.sceneTokens);
    return classifyTokens(sceneTokens, adapter, [SCENE_FALLBACK_CAVEAT]);
  }

  return {
    pcs: [],
    hostiles: [],
    unsupported: [],
    caveats: [NO_COMBAT_CAVEAT]
  };
}

function classifyTokens<TokenLike extends { name?: string }>(
  tokens: (TokenLike | undefined)[],
  adapter: SystemAdapter<TokenLike>,
  baseCaveats: string[]
): EncounterParticipants<TokenLike> {
  const pcs: EncounterParticipant<TokenLike>[] = [];
  const hostiles: EncounterParticipant<TokenLike>[] = [];
  const unsupported: string[] = [];
  const caveats: string[] = [...baseCaveats];

  for (const token of tokens) {
    if (!token) {
      unsupported.push(`${UNKNOWN_NAME} (no token)`);
      continue;
    }

    let snapshot: CombatantSnapshot | null;
    try {
      snapshot = adapter.getCombatantFromToken(token);
    } catch {
      unsupported.push(token.name ?? UNKNOWN_NAME);
      continue;
    }

    if (!snapshot) {
      unsupported.push(token.name ?? UNKNOWN_NAME);
      continue;
    }

    if (snapshot.disposition === 'pc') {
      pcs.push({ token, snapshot });
    } else if (snapshot.disposition === 'enemy') {
      hostiles.push({ token, snapshot });
    } else {
      caveats.push(
        `${snapshot.name} is ${snapshot.disposition} and was excluded from the danger board.`
      );
    }
  }

  return { pcs, hostiles, unsupported, caveats };
}

export function getEncounterParticipants<TokenLike extends { name?: string }>(
  adapter: SystemAdapter<TokenLike>,
  options: ResolveOptions = {}
): EncounterParticipants<TokenLike> {
  const combat = game.combat as
    | { combatants?: Iterable<{ token?: { object?: TokenLike } | TokenLike }> }
    | undefined;
  const combatants = combat?.combatants
    ? Array.from(combat.combatants).map((c) => ({ token: extractCombatantToken<TokenLike>(c) }))
    : undefined;

  const sceneTokens = canvas.tokens?.placeables as Iterable<TokenLike> | undefined;

  return resolveEncounterParticipants(
    { combatants, sceneTokens },
    adapter,
    options
  );
}

function extractCombatantToken<TokenLike>(
  combatant: { token?: { object?: TokenLike } | TokenLike }
): TokenLike | undefined {
  const token = combatant.token;
  if (!token) return undefined;
  const maybeObject = (token as { object?: TokenLike }).object;
  return maybeObject ?? (token as TokenLike);
}
