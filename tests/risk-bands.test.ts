import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RISK_BANDS, riskLabelFor, riskBandRangeText } from '../src/engine/risk-bands';
import { RISK_LEGEND } from '../src/ui/danger-board';

describe('risk bands', () => {
  it('maps probabilities to labels at the documented thresholds', () => {
    expect(riskLabelFor(0)).toBe('Low');
    expect(riskLabelFor(0.049)).toBe('Low');
    expect(riskLabelFor(0.05)).toBe('Guarded');
    expect(riskLabelFor(0.15)).toBe('Dangerous');
    expect(riskLabelFor(0.35)).toBe('Severe');
    expect(riskLabelFor(0.6)).toBe('Grim');
    expect(riskLabelFor(1)).toBe('Grim');
  });
  it('legend is derived from the bands, most dangerous first', () => {
    expect(RISK_LEGEND.map((e) => e.label)).toEqual([
      'Grim',
      'Severe',
      'Dangerous',
      'Guarded',
      'Low'
    ]);
    expect(RISK_LEGEND.map((e) => e.range)).toEqual(['≥60%', '35–60%', '15–35%', '5–15%', '<5%']);
  });
  it('lang tooltip mentions every band label and percentage', () => {
    const en = JSON.parse(readFileSync('lang/en.json', 'utf8'));
    const html: string = en.GrimArithmetic.Common.RiskPillTooltipHtml;
    for (const band of RISK_BANDS) {
      expect(html).toContain(band.label);
      expect(html).toContain(String(Math.round(band.min * 100)));
    }
    expect(riskBandRangeText(RISK_BANDS[0])).toBe('<5%');
  });
});
