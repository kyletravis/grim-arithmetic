export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function optionalNumber(value: unknown): number | undefined {
  return isNumber(value) ? value : undefined;
}

export function optionalNumberLike(value: unknown): number | undefined {
  if (isNumber(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.trim().replace(/^\+/, ''));
  return isNumber(parsed) ? parsed : undefined;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const record = asRecord(entry);
      if (typeof record.slug === 'string') return record.slug;
      if (typeof record.name === 'string') return record.name;
      return null;
    })
    .filter((entry): entry is string => typeof entry === 'string');
}

export function getActorItems(items: unknown): UnknownRecord[] {
  if (Array.isArray(items)) return items.filter(isRecord);

  const contents = asRecord(items).contents;
  if (Array.isArray(contents)) return contents.filter(isRecord);

  if (isRecord(items) && typeof items.filter === 'function') {
    const filtered = (items.filter as (predicate: (item: unknown) => boolean) => unknown)(isRecord);
    return Array.isArray(filtered) ? filtered.filter(isRecord) : [];
  }

  return [];
}

export type ItemLike = {
  id?: string;
  name?: string;
  type?: string;
  system?: unknown;
};

/** Actor items as loosely-typed item records (Foundry collection or array). */
export function toItemLikes(items: unknown): ItemLike[] {
  return getActorItems(items).filter((item): item is ItemLike => isRecord(item));
}
