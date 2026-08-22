/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Minimal ambient types for the Foundry globals Grim Arithmetic touches.
 * Deliberately narrow: only the members this module reads/writes. Widen
 * here (not with inline casts) when new Foundry surface is needed.
 */
interface GrimSettingRegistration {
  config?: boolean;
}

interface GrimGameSettings {
  register(module: string, key: string, data: Record<string, unknown>): void;
  get(module: string, key: string): unknown;
  /** Registry of every registered setting keyed "module.key" (Foundry ClientSettings#settings). */
  settings?: { get(key: string): GrimSettingRegistration | undefined };
}

interface GrimTooltipManagerClass {
  TOOLTIP_ACTIVATION_MS?: number;
}

declare const game: {
  user?: { isGM?: boolean; targets?: Iterable<unknown> };
  settings: GrimGameSettings;
  modules: { get(id: string): { api?: unknown } | undefined };
  combat?: unknown;
  system?: { id?: string };
  tooltip?: { constructor?: GrimTooltipManagerClass };
  i18n?: {
    localize(key: string): string;
    format(key: string, data?: Record<string, unknown>): string;
  };
};

declare const canvas: {
  tokens?: {
    controlled?: unknown[];
    placeables?: unknown[];
    get(id: string): unknown;
  };
};

declare const Hooks: {
  on(name: string, fn: (...args: any[]) => unknown): number;
  once(name: string, fn: (...args: any[]) => unknown): number;
  off(name: string, id: number): void;
};

declare const foundry: {
  applications: {
    api: {
      ApplicationV2: unknown;
      HandlebarsApplicationMixin: (base: unknown) => unknown;
    };
  };
};

declare const ui: {
  notifications?: { warn(message: string): void; error(message: string): void };
};

declare const Handlebars:
  { registerHelper(name: string, fn: (...args: unknown[]) => unknown): void } | undefined;
