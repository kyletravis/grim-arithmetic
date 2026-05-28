import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lang = JSON.parse(readFileSync(join(process.cwd(), 'lang/en.json'), 'utf8')) as {
  GrimArithmetic: { Common: Record<string, string> };
};
const common = lang.GrimArithmetic.Common;
const TIERS = ['Low', 'Guarded', 'Dangerous', 'Severe', 'Grim'];

describe('KHT-121: risk pill tooltip lists the full ladder', () => {
  it('RiskPillTooltipHtml is multi-line HTML listing all five tiers', () => {
    const html = common.RiskPillTooltipHtml;
    expect(html).toBeDefined();
    expect(html).toContain('<br>');
    for (const tier of TIERS) expect(html).toContain(tier);
    expect(html).not.toMatch(/<(?!br>)/); // no stray tags besides <br>
  });

  it('RiskPillTooltip plain fallback lists all five tiers', () => {
    const text = common.RiskPillTooltip;
    for (const tier of TIERS) expect(text).toContain(tier);
  });
});
