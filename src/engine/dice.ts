export function averageDamage(formula: string): number {
  const normalized = formula.replace(/\s+/g, '');

  if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(normalized)) {
    throw new Error(`Unsupported damage formula: ${formula}`);
  }

  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];
  return terms.reduce((sum, term) => sum + averageTerm(term), 0);
}

function averageTerm(term: string): number {
  const sign = term.startsWith('-') ? -1 : 1;
  const unsigned = term.replace(/^[+-]/, '');
  const diceMatch = unsigned.match(/^(\d+)d(\d+)$/);

  if (diceMatch) {
    const count = Number(diceMatch[1]);
    const faces = Number(diceMatch[2]);
    return sign * count * ((faces + 1) / 2);
  }

  return sign * Number(unsigned);
}
