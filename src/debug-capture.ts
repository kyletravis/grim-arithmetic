type UnknownRecord = Record<string, unknown>;

type DebugTokenLike = {
  id?: string;
  name?: string;
  document?: {
    disposition?: number;
  };
  actor?: {
    id?: string;
    name?: string;
    type?: string;
    system?: unknown;
    itemTypes?: unknown;
    items?: unknown;
  };
};

export function buildDebugCapture(token: DebugTokenLike): unknown {
  const actor = token.actor;
  const system = asRecord(actor?.system);

  return {
    token: {
      id: token.id,
      name: token.name,
      disposition: token.document?.disposition
    },
    actor: actor
      ? {
          id: actor.id,
          name: actor.name,
          type: actor.type,
          system: {
            attributes: pickAttributes(system),
            saves: system.saves,
            traits: system.traits
          },
          itemTypes: pickItemTypes(actor.itemTypes),
          meleeItems: getActorItems(actor.items)
            .filter((item) => item.type === 'melee')
            .map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              system: {
                bonus: asRecord(item.system).bonus,
                attack: asRecord(item.system).attack,
                damageRolls: asRecord(item.system).damageRolls,
                traits: asRecord(item.system).traits
              }
            }))
        }
      : null
  };
}

export function logDebugCapture(token: DebugTokenLike): unknown {
  const capture = buildDebugCapture(token);
  console.log('Grim Arithmetic | Debug capture', capture);
  return capture;
}

function pickAttributes(system: UnknownRecord): unknown {
  const attributes = asRecord(system.attributes);
  return {
    hp: attributes.hp,
    ac: attributes.ac
  };
}

function pickItemTypes(itemTypes: unknown): unknown {
  const record = asRecord(itemTypes);
  return {
    condition: record.condition
  };
}

function getActorItems(items: unknown): UnknownRecord[] {
  if (Array.isArray(items)) return items.filter(isRecord);

  const contents = asRecord(items).contents;
  if (Array.isArray(contents)) return contents.filter(isRecord);

  if (isRecord(items) && typeof items.filter === 'function') {
    const filtered = (items.filter as (predicate: (item: unknown) => boolean) => unknown)(isRecord);
    return Array.isArray(filtered) ? filtered.filter(isRecord) : [];
  }

  return [];
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}
