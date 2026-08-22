import { AttackSnapshot, CombatantSnapshot } from '../systems/base-adapter';
import { MapType } from './mortality';

export interface PanelControls {
  strikes: 1 | 2 | 3;
  mapMode: 'auto' | MapType;
  shieldBonus: 0 | 1 | 2;
  woundedOverride: 'current' | '0' | '1' | '2' | '3';
  heroPointMode: 'actor' | 'available' | 'unavailable';
  attackId: string;
}

export const DEFAULT_PANEL_CONTROLS: PanelControls = {
  strikes: 2,
  mapMode: 'auto',
  shieldBonus: 0,
  woundedOverride: 'current',
  heroPointMode: 'actor',
  attackId: ''
};

export function resolveMapType(
  mapMode: PanelControls['mapMode'],
  attackMapType: AttackSnapshot['mapType']
): MapType {
  if (mapMode !== 'auto') return mapMode;
  return attackMapType === 'unknown' ? 'normal' : attackMapType;
}

export function resolveWounded(
  subject: CombatantSnapshot,
  override: PanelControls['woundedOverride']
): number {
  if (override === 'current') return subject.deathState?.wounded ?? 0;
  return Number(override);
}

export function resolveHeroPointAvailability(
  subject: CombatantSnapshot,
  heroPointMode: PanelControls['heroPointMode']
): boolean {
  if (heroPointMode === 'available') return true;
  if (heroPointMode === 'unavailable') return false;
  return (subject.deathState?.heroPoints ?? 0) > 0;
}
