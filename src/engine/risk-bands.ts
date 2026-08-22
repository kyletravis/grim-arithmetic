export type RiskLabel = 'Low' | 'Guarded' | 'Dangerous' | 'Severe' | 'Grim';

export interface RiskBand {
  label: RiskLabel;
  /** Inclusive lower bound as a probability. */
  min: number;
  /** Exclusive upper bound; null for the top band. */
  max: number | null;
}

/** Ordered least → most dangerous. Edit here only; UI legend, pills, and engine labels derive from this. */
export const RISK_BANDS: readonly RiskBand[] = Object.freeze([
  { label: 'Low', min: 0, max: 0.05 },
  { label: 'Guarded', min: 0.05, max: 0.15 },
  { label: 'Dangerous', min: 0.15, max: 0.35 },
  { label: 'Severe', min: 0.35, max: 0.6 },
  { label: 'Grim', min: 0.6, max: null }
]);

export function riskLabelFor(probability: number): RiskLabel {
  for (const band of RISK_BANDS) {
    if (band.max === null || probability < band.max) return band.label;
  }
  return 'Grim';
}

export function riskClassFor(probability: number): string {
  return riskLabelFor(probability).toLowerCase();
}

export function riskBandRangeText(band: RiskBand): string {
  const lo = Math.round(band.min * 100);
  if (band.min === 0 && band.max !== null) return `<${Math.round(band.max * 100)}%`;
  if (band.max === null) return `≥${lo}%`;
  return `${lo}–${Math.round(band.max * 100)}%`;
}
