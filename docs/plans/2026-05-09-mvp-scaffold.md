# Grim Arithmetic MVP Scaffold Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build the first working scaffold for Grim Arithmetic: a Foundry VTT v13.351+ module with a tested, Foundry-agnostic probability engine and a minimal GM-only risk panel foundation.

**Architecture:** Separate the module into three layers: Foundry integration, PF2e system adapter, and pure mortality math engine. The MVP should first prove the math with unit tests, then wire the engine into Foundry through a small GM-only UI.

**Tech Stack:** Foundry VTT v13 Build 351+, PF2e system, TypeScript, Vite or esbuild, Vitest, ESLint, Prettier, Handlebars templates, CSS.

---

## Current Context

Repo path:

```bash
/Users/kyle/git/grim-arithmetic
```

Existing files:

```text
README.md
PRD.md
```

Initial product decisions already made:

- Minimum Foundry target: **v13 Build 351**.
- Foundry v14 support is intentionally deferred.
- PF2e is the first supported system.
- SF2e is deferred until v14 compatibility work.
- MVP focuses on **immediate threat / down probability**, not full permanent death probability.
- Permanent death probability should be represented as a planned future milestone, not a live MVP percentage.
- Default UI should be **GM-only**.

---

## Implementation Rules

1. **Architect-first:** keep core math separate from Foundry globals.
2. **TDD-first for engine code:** write tests before implementation.
3. **YAGNI:** do not model every PF2e rule in MVP.
4. **Assumptions are first-class:** every risk result must include assumptions and not-modeled caveats.
5. **GM-only by default:** no player-facing chat cards or UI in MVP.
6. **Frequent commits:** commit after each completed task or small group of tightly related tasks.
7. **No permanent-death percentage in MVP:** show it as “not modeled yet” or omit it from live calculations.

---

## Milestone A — Repository and Tooling Scaffold

### Task A1: Add project metadata and package scripts

**Objective:** Create the Node/TypeScript project foundation.

**Files:**

- Create: `package.json`
- Create: `.gitignore`
- Create: `.editorconfig`

**Step 1: Create `package.json`**

Use this initial content:

```json
{
  "name": "grim-arithmetic",
  "version": "0.1.0",
  "description": "Foundry VTT module for GM-facing PF2e mortality and encounter-risk analysis.",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write .",
    "check": "npm run lint && npm run test && npm run build"
  },
  "keywords": [
    "foundry-vtt",
    "pf2e",
    "pathfinder-2e",
    "mortality",
    "encounter-analysis"
  ],
  "author": "Kyle Travis",
  "license": "MIT",
  "devDependencies": {
    "@eslint/js": "latest",
    "@types/node": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

**Step 2: Create `.gitignore`**

```gitignore
node_modules/
dist/
coverage/
.DS_Store
*.log
.env
.env.*
!.env.example
```

**Step 3: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

**Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected:

- `package-lock.json` is created.
- `node_modules/` is created but ignored by git.

**Step 5: Verify**

Run:

```bash
npm run test
```

Expected initially:

- Vitest reports no tests or exits cleanly once configured in later tasks. If it errors because no config/files exist yet, continue to Task A2 before treating it as a failure.

**Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore .editorconfig
git commit -m "chore: add project metadata and npm scripts"
```

---

### Task A2: Add TypeScript, Vite, Vitest, and lint configs

**Objective:** Configure the build/test/lint toolchain.

**Files:**

- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`

**Step 1: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts", "eslint.config.js"]
}
```

**Step 2: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'GrimArithmetic',
      formats: ['es'],
      fileName: () => 'grim-arithmetic.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'grim-arithmetic.js',
        assetFileNames: 'grim-arithmetic.[ext]'
      }
    }
  }
});
```

**Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
```

**Step 4: Create `eslint.config.js`**

```js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        game: 'readonly',
        ui: 'readonly',
        canvas: 'readonly',
        foundry: 'readonly',
        Hooks: 'readonly',
        Application: 'readonly',
        Dialog: 'readonly',
        CONFIG: 'readonly',
        CONST: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off'
    }
  }
];
```

**Note:** This is intentionally lightweight. Add `typescript-eslint` later if needed.

**Step 5: Create `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "none",
  "printWidth": 100
}
```

**Step 6: Create placeholder source**

Create: `src/main.ts`

```ts
Hooks.once('init', () => {
  console.log('Grim Arithmetic | Initializing');
});
```

**Step 7: Verify**

Run:

```bash
npm run build
npm run test
```

Expected:

- Build creates `dist/grim-arithmetic.js`.
- Tests run with no test files or pass once tests are added later.

**Step 8: Commit**

```bash
git add tsconfig.json vite.config.ts vitest.config.ts eslint.config.js .prettierrc.json src/main.ts dist/grim-arithmetic.js dist/grim-arithmetic.js.map
git commit -m "chore: configure TypeScript build and tests"
```

---

### Task A3: Add Foundry v13 module manifest

**Objective:** Make the project recognizable as a Foundry module targeting v13.351+.

**Files:**

- Create: `module.json`

**Step 1: Create `module.json`**

```json
{
  "id": "grim-arithmetic",
  "title": "Grim Arithmetic",
  "description": "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
  "version": "0.1.0",
  "authors": [
    {
      "name": "Kyle Travis"
    }
  ],
  "compatibility": {
    "minimum": "13.351",
    "verified": "13.351"
  },
  "relationships": {
    "systems": [
      {
        "id": "pf2e",
        "type": "system"
      }
    ]
  },
  "esmodules": ["dist/grim-arithmetic.js"],
  "styles": ["styles/grim-arithmetic.css"],
  "templates": ["templates/mortality-panel.hbs"],
  "url": "",
  "manifest": "",
  "download": ""
}
```

**Step 2: Add empty style/template files**

Create: `styles/grim-arithmetic.css`

```css
.grim-arithmetic-panel {
  padding: 0.75rem;
}
```

Create: `templates/mortality-panel.hbs`

```hbs
<section class="grim-arithmetic-panel">
  <h2>Grim Arithmetic</h2>
  <p>{{message}}</p>
</section>
```

**Step 3: Verify build still works**

Run:

```bash
npm run build
```

Expected:

- Build succeeds.
- `module.json` points at an existing `dist/grim-arithmetic.js` after build.

**Step 4: Commit**

```bash
git add module.json styles/grim-arithmetic.css templates/mortality-panel.hbs
git commit -m "feat: add Foundry v13 module manifest"
```

---

## Milestone B — Pure Probability Engine

### Task B1: Implement PF2e degree-of-success calculation

**Objective:** Calculate PF2e degree of success for d20 checks, including natural 20/natural 1 shifts.

**Files:**

- Create: `src/engine/degree-of-success.ts`
- Create: `tests/degree-of-success.test.ts`

**Step 1: Write failing tests**

Create `tests/degree-of-success.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { degreeOfSuccess } from '../src/engine/degree-of-success';

describe('degreeOfSuccess', () => {
  it('returns critical success when total is dc plus 10', () => {
    expect(degreeOfSuccess({ die: 10, total: 30, dc: 20 })).toBe('criticalSuccess');
  });

  it('returns success when total meets dc', () => {
    expect(degreeOfSuccess({ die: 10, total: 20, dc: 20 })).toBe('success');
  });

  it('returns failure when total is below dc', () => {
    expect(degreeOfSuccess({ die: 9, total: 19, dc: 20 })).toBe('failure');
  });

  it('returns critical failure when total is dc minus 10 or lower', () => {
    expect(degreeOfSuccess({ die: 1, total: 10, dc: 20 })).toBe('criticalFailure');
  });

  it('natural 20 improves success by one degree', () => {
    expect(degreeOfSuccess({ die: 20, total: 19, dc: 20 })).toBe('success');
  });

  it('natural 1 worsens success by one degree', () => {
    expect(degreeOfSuccess({ die: 1, total: 20, dc: 20 })).toBe('failure');
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test -- tests/degree-of-success.test.ts
```

Expected:

- Fails because `degree-of-success.ts` does not exist.

**Step 3: Implement minimal function**

Create `src/engine/degree-of-success.ts`:

```ts
export type DegreeOfSuccess = 'criticalFailure' | 'failure' | 'success' | 'criticalSuccess';

const ORDER: DegreeOfSuccess[] = ['criticalFailure', 'failure', 'success', 'criticalSuccess'];

export interface DegreeOfSuccessInput {
  die: number;
  total: number;
  dc: number;
}

export function degreeOfSuccess(input: DegreeOfSuccessInput): DegreeOfSuccess {
  const { die, total, dc } = input;
  let degree: DegreeOfSuccess;

  if (total >= dc + 10) {
    degree = 'criticalSuccess';
  } else if (total >= dc) {
    degree = 'success';
  } else if (total <= dc - 10) {
    degree = 'criticalFailure';
  } else {
    degree = 'failure';
  }

  if (die === 20) return shiftDegree(degree, 1);
  if (die === 1) return shiftDegree(degree, -1);
  return degree;
}

function shiftDegree(degree: DegreeOfSuccess, shift: -1 | 1): DegreeOfSuccess {
  const index = ORDER.indexOf(degree);
  const nextIndex = Math.max(0, Math.min(ORDER.length - 1, index + shift));
  return ORDER[nextIndex];
}
```

**Step 4: Verify**

```bash
npm run test -- tests/degree-of-success.test.ts
```

Expected:

- All tests pass.

**Step 5: Commit**

```bash
git add src/engine/degree-of-success.ts tests/degree-of-success.test.ts
git commit -m "feat: add PF2e degree of success calculation"
```

---

### Task B2: Implement attack outcome probabilities

**Objective:** Calculate hit, crit, miss, and critical failure probabilities for a Strike.

**Files:**

- Create: `src/engine/attack-probability.ts`
- Create: `tests/attack-probability.test.ts`

**Step 1: Write failing tests**

Create `tests/attack-probability.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { attackOutcomeProbabilities } from '../src/engine/attack-probability';

describe('attackOutcomeProbabilities', () => {
  it('returns probabilities that sum to 1', () => {
    const result = attackOutcomeProbabilities({ attackBonus: 10, ac: 20 });
    const total = result.criticalSuccess + result.success + result.failure + result.criticalFailure;
    expect(total).toBeCloseTo(1);
  });

  it('has a 5 percent natural 20 crit floor when otherwise only a success', () => {
    const result = attackOutcomeProbabilities({ attackBonus: 0, ac: 20 });
    expect(result.criticalSuccess).toBeCloseTo(0.05);
  });

  it('returns higher crit chance when attack bonus greatly exceeds AC', () => {
    const result = attackOutcomeProbabilities({ attackBonus: 20, ac: 20 });
    expect(result.criticalSuccess).toBeGreaterThan(0.5);
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test -- tests/attack-probability.test.ts
```

Expected:

- Fails because module does not exist.

**Step 3: Implement**

Create `src/engine/attack-probability.ts`:

```ts
import { DegreeOfSuccess, degreeOfSuccess } from './degree-of-success';

export interface AttackProbabilityInput {
  attackBonus: number;
  ac: number;
}

export interface AttackOutcomeProbabilities {
  criticalSuccess: number;
  success: number;
  failure: number;
  criticalFailure: number;
}

export function attackOutcomeProbabilities(input: AttackProbabilityInput): AttackOutcomeProbabilities {
  const counts: Record<DegreeOfSuccess, number> = {
    criticalSuccess: 0,
    success: 0,
    failure: 0,
    criticalFailure: 0
  };

  for (let die = 1; die <= 20; die += 1) {
    const degree = degreeOfSuccess({
      die,
      total: die + input.attackBonus,
      dc: input.ac
    });
    counts[degree] += 1;
  }

  return {
    criticalSuccess: counts.criticalSuccess / 20,
    success: counts.success / 20,
    failure: counts.failure / 20,
    criticalFailure: counts.criticalFailure / 20
  };
}
```

**Step 4: Verify**

```bash
npm run test -- tests/attack-probability.test.ts tests/degree-of-success.test.ts
```

Expected:

- All tests pass.

**Step 5: Commit**

```bash
git add src/engine/attack-probability.ts tests/attack-probability.test.ts
git commit -m "feat: add attack outcome probabilities"
```

---

### Task B3: Implement average dice damage parser

**Objective:** Parse simple damage formulas and calculate average damage.

**Files:**

- Create: `src/engine/dice.ts`
- Create: `tests/dice.test.ts`

**Scope:** MVP parser supports formulas like:

- `1d8`
- `2d8+6`
- `2d6 + 4`
- `1d12+1d6+3`

It does not need to support roll options, damage types, inline Foundry syntax, fatal/deadly, or conditional damage yet.

**Step 1: Write failing tests**

Create `tests/dice.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { averageDamage } from '../src/engine/dice';

describe('averageDamage', () => {
  it('calculates average for a single die', () => {
    expect(averageDamage('1d8')).toBeCloseTo(4.5);
  });

  it('calculates average for dice plus modifier', () => {
    expect(averageDamage('2d8+6')).toBeCloseTo(15);
  });

  it('ignores whitespace', () => {
    expect(averageDamage('2d6 + 4')).toBeCloseTo(11);
  });

  it('handles multiple dice terms', () => {
    expect(averageDamage('1d12+1d6+3')).toBeCloseTo(13);
  });

  it('throws for unsupported formulas', () => {
    expect(() => averageDamage('2d8[persistent,fire]+4')).toThrow();
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test -- tests/dice.test.ts
```

Expected:

- Fails because module does not exist.

**Step 3: Implement**

Create `src/engine/dice.ts`:

```ts
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
```

**Step 4: Verify**

```bash
npm run test -- tests/dice.test.ts
```

Expected:

- All dice tests pass.

**Step 5: Commit**

```bash
git add src/engine/dice.ts tests/dice.test.ts
git commit -m "feat: add average damage parser"
```

---

### Task B4: Implement immediate down-risk calculation

**Objective:** Calculate down probability and expected HP after one enemy turn using average damage.

**Files:**

- Create: `src/engine/mortality.ts`
- Create: `tests/mortality.test.ts`

**Step 1: Write failing tests**

Create `tests/mortality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { immediateDownRisk } from '../src/engine/mortality';

describe('immediateDownRisk', () => {
  it('returns zero down probability when average hit and crit cannot down target', () => {
    const result = immediateDownRisk({
      hp: 30,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d8+2',
      strikes: 1,
      mapType: 'normal'
    });

    expect(result.downProbability).toBe(0);
    expect(result.assumptions).toContain('Uses average damage, not full dice distribution.');
  });

  it('returns crit chance as down probability when only crit average damage downs target', () => {
    const result = immediateDownRisk({
      hp: 12,
      ac: 20,
      attackBonus: 10,
      damageFormula: '1d8+2',
      strikes: 1,
      mapType: 'normal'
    });

    expect(result.downProbability).toBeGreaterThan(0);
    expect(result.topRiskDrivers[0]).toContain('crit');
  });

  it('supports three strike MAP sequences', () => {
    const result = immediateDownRisk({
      hp: 20,
      ac: 20,
      attackBonus: 12,
      damageFormula: '1d8+6',
      strikes: 3,
      mapType: 'normal'
    });

    expect(result.hitChanceByStrike).toHaveLength(3);
    expect(result.critChanceByStrike).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test -- tests/mortality.test.ts
```

Expected:

- Fails because module does not exist.

**Step 3: Implement first-pass down-risk model**

Create `src/engine/mortality.ts`:

```ts
import { attackOutcomeProbabilities } from './attack-probability';
import { averageDamage } from './dice';

export type MapType = 'normal' | 'agile' | 'none';

export interface ImmediateDownRiskInput {
  hp: number;
  ac: number;
  attackBonus: number;
  damageFormula: string;
  strikes: 1 | 2 | 3;
  mapType: MapType;
}

export interface ImmediateDownRiskResult {
  downProbability: number;
  expectedHpAfterTurn: number;
  hitChanceByStrike: number[];
  critChanceByStrike: number[];
  riskLabel: 'Low' | 'Guarded' | 'Dangerous' | 'Severe' | 'Grim';
  topRiskDrivers: string[];
  assumptions: string[];
  notModeled: string[];
}

export function immediateDownRisk(input: ImmediateDownRiskInput): ImmediateDownRiskResult {
  const baseDamage = averageDamage(input.damageFormula);
  const mapPenalties = getMapPenalties(input.mapType).slice(0, input.strikes);
  const hitChanceByStrike: number[] = [];
  const critChanceByStrike: number[] = [];

  let expectedDamage = 0;
  let survivalProbability = 1;

  for (const penalty of mapPenalties) {
    const outcome = attackOutcomeProbabilities({
      attackBonus: input.attackBonus + penalty,
      ac: input.ac
    });

    hitChanceByStrike.push(outcome.success);
    critChanceByStrike.push(outcome.criticalSuccess);

    const hitDamage = baseDamage;
    const critDamage = baseDamage * 2;
    expectedDamage += outcome.success * hitDamage + outcome.criticalSuccess * critDamage;

    const downChanceThisStrike =
      (hitDamage >= input.hp ? outcome.success : 0) +
      (critDamage >= input.hp ? outcome.criticalSuccess : 0);

    survivalProbability *= 1 - downChanceThisStrike;
  }

  const downProbability = clampProbability(1 - survivalProbability);
  const expectedHpAfterTurn = Math.max(0, input.hp - expectedDamage);

  return {
    downProbability,
    expectedHpAfterTurn,
    hitChanceByStrike,
    critChanceByStrike,
    riskLabel: riskLabel(downProbability),
    topRiskDrivers: buildRiskDrivers(downProbability, critChanceByStrike),
    assumptions: [
      'Uses average damage, not full dice distribution.',
      'Critical damage is modeled as simple double damage.',
      `Enemy turn model: ${input.strikes} Strike${input.strikes === 1 ? '' : 's'}.`,
      `MAP model: ${input.mapType}.`
    ],
    notModeled: [
      'Resistance, weakness, and immunity.',
      'Deadly, fatal, precision, splash, and persistent damage.',
      'Reactions such as Shield Block or Champion reactions.',
      'Healing before or during the enemy turn.',
      'Permanent death probability.'
    ]
  };
}

function getMapPenalties(mapType: MapType): number[] {
  if (mapType === 'agile') return [0, -4, -8];
  if (mapType === 'none') return [0, 0, 0];
  return [0, -5, -10];
}

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function riskLabel(probability: number): ImmediateDownRiskResult['riskLabel'] {
  if (probability < 0.05) return 'Low';
  if (probability < 0.15) return 'Guarded';
  if (probability < 0.35) return 'Dangerous';
  if (probability < 0.6) return 'Severe';
  return 'Grim';
}

function buildRiskDrivers(downProbability: number, critChanceByStrike: number[]): string[] {
  if (downProbability === 0) return ['No average hit or crit in the selected sequence downs the PC.'];

  const highestCrit = Math.max(...critChanceByStrike);
  return [`Down risk is primarily crit-driven; highest strike crit chance is ${Math.round(highestCrit * 100)}%.`];
}
```

**Important limitation:** This first-pass model treats each Strike independently against starting HP. It does not yet convolve cumulative damage across multiple hits. That should be explicit in `notModeled` or improved in Task B5.

**Step 4: Verify**

```bash
npm run test -- tests/mortality.test.ts tests/attack-probability.test.ts tests/dice.test.ts tests/degree-of-success.test.ts
```

Expected:

- All engine tests pass.

**Step 5: Commit**

```bash
git add src/engine/mortality.ts tests/mortality.test.ts
git commit -m "feat: add immediate down risk calculation"
```

---

### Task B5: Improve cumulative damage modeling for 2–3 Strikes

**Objective:** Avoid undercounting down probability when multiple hits cumulatively down the PC.

**Files:**

- Modify: `src/engine/mortality.ts`
- Modify: `tests/mortality.test.ts`

**Step 1: Add failing cumulative-damage test**

Add to `tests/mortality.test.ts`:

```ts
it('counts cumulative hits that down the target across multiple strikes', () => {
  const result = immediateDownRisk({
    hp: 20,
    ac: 20,
    attackBonus: 10,
    damageFormula: '1d8+6',
    strikes: 2,
    mapType: 'none'
  });

  expect(result.downProbability).toBeGreaterThan(0);
});
```

**Step 2: Run test**

```bash
npm run test -- tests/mortality.test.ts
```

Expected:

- Fails or reveals the simplistic model does not handle cumulative hit damage correctly.

**Step 3: Implement discrete average-damage state expansion**

Approach:

- Track probability mass by cumulative average damage.
- For each strike, branch into miss / hit / crit average damage outcomes.
- Sum probability where cumulative damage >= HP.
- This is still average-damage approximation, but handles cumulative hits.

Pseudo-code:

```ts
let states = new Map<number, number>([[0, 1]]);

for each strike:
  next = new Map();
  for [damageSoFar, probability] of states:
    add miss branch: damageSoFar, probability * miss
    add hit branch: damageSoFar + baseDamage, probability * hit
    add crit branch: damageSoFar + baseDamage * 2, probability * crit
  states = next

downProbability = sum(prob where damage >= hp)
```

**Step 4: Verify**

```bash
npm run test -- tests/mortality.test.ts
npm run check
```

Expected:

- All tests pass.
- Lint/build pass.

**Step 5: Commit**

```bash
git add src/engine/mortality.ts tests/mortality.test.ts
git commit -m "fix: account for cumulative strike damage"
```

---

## Milestone C — Foundry Integration Foundation

### Task C1: Add module constants and settings registration

**Objective:** Define module constants and register MVP settings.

**Files:**

- Create: `src/constants.ts`
- Create: `src/settings.ts`
- Modify: `src/main.ts`

**Step 1: Create `src/constants.ts`**

```ts
export const MODULE_ID = 'grim-arithmetic';
export const MODULE_TITLE = 'Grim Arithmetic';
```

**Step 2: Create `src/settings.ts`**

```ts
import { MODULE_ID } from './constants';

export function registerSettings(): void {
  game.settings.register(MODULE_ID, 'defaultStrikes', {
    name: 'Default enemy Strike count',
    hint: 'Default number of Strikes used for immediate-threat estimates.',
    scope: 'world',
    config: true,
    type: Number,
    default: 2,
    choices: {
      1: '1 Strike',
      2: '2 Strikes',
      3: '3 Strikes'
    }
  });

  game.settings.register(MODULE_ID, 'debugLogging', {
    name: 'Debug logging',
    hint: 'Log Grim Arithmetic debug information to the browser console.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });
}
```

**Step 3: Modify `src/main.ts`**

```ts
import { MODULE_TITLE } from './constants';
import { registerSettings } from './settings';

Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  registerSettings();
});
```

**Step 4: Verify**

```bash
npm run build
```

Expected:

- Build passes.

**Step 5: Commit**

```bash
git add src/constants.ts src/settings.ts src/main.ts dist/
git commit -m "feat: register Grim Arithmetic settings"
```

---

### Task C2: Add minimal GM-only application shell

**Objective:** Create a Foundry application window that renders a placeholder risk panel for GMs.

**Files:**

- Create: `src/ui/mortality-panel.ts`
- Modify: `src/main.ts`
- Modify: `templates/mortality-panel.hbs`
- Modify: `styles/grim-arithmetic.css`

**Step 1: Create panel class**

Create `src/ui/mortality-panel.ts`:

```ts
import { MODULE_ID, MODULE_TITLE } from '../constants';

export class MortalityPanel extends Application {
  static override get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-panel`,
      title: MODULE_TITLE,
      template: `modules/${MODULE_ID}/templates/mortality-panel.hbs`,
      width: 420,
      height: 'auto',
      resizable: true,
      classes: ['grim-arithmetic-window']
    });
  }

  override async getData(): Promise<Record<string, unknown>> {
    return {
      message: 'Select a PC token and target one enemy token to estimate immediate down risk.',
      permanentDeath: 'Permanent death probability is planned for a future milestone and is not modeled in MVP.'
    };
  }
}
```

**Step 2: Register a temporary API handle**

Modify `src/main.ts`:

```ts
import { MODULE_ID, MODULE_TITLE } from './constants';
import { registerSettings } from './settings';
import { MortalityPanel } from './ui/mortality-panel';

Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  registerSettings();
});

Hooks.once('ready', () => {
  if (!game.user?.isGM) return;

  game.modules.get(MODULE_ID)!.api = {
    openPanel: () => new MortalityPanel().render(true)
  };
});
```

**Step 3: Update template**

Modify `templates/mortality-panel.hbs`:

```hbs
<section class="grim-arithmetic-panel">
  <header class="grim-arithmetic-panel__header">
    <h2>Grim Arithmetic</h2>
    <p class="grim-arithmetic-panel__tagline">Immediate mortality pressure, not fate.</p>
  </header>

  <p>{{message}}</p>

  <aside class="grim-arithmetic-panel__caveat">
    {{permanentDeath}}
  </aside>
</section>
```

**Step 4: Update CSS**

Modify `styles/grim-arithmetic.css`:

```css
.grim-arithmetic-panel {
  padding: 0.75rem;
}

.grim-arithmetic-panel__header h2 {
  margin: 0 0 0.25rem;
}

.grim-arithmetic-panel__tagline {
  margin: 0 0 0.75rem;
  opacity: 0.8;
  font-style: italic;
}

.grim-arithmetic-panel__caveat {
  margin-top: 0.75rem;
  padding: 0.5rem;
  border-left: 3px solid #8b1e1e;
  background: rgba(139, 30, 30, 0.12);
}
```

**Step 5: Verify**

```bash
npm run build
```

Manual Foundry smoke test later:

```js
game.modules.get('grim-arithmetic').api.openPanel()
```

Expected:

- GM can open placeholder panel from browser console.
- Non-GMs do not get the API handle.

**Step 6: Commit**

```bash
git add src/main.ts src/ui/mortality-panel.ts templates/mortality-panel.hbs styles/grim-arithmetic.css dist/
git commit -m "feat: add GM-only mortality panel shell"
```

---

### Task C3: Add token-control button to open panel

**Objective:** Provide a real GM UI entry point without relying on console commands.

**Files:**

- Create: `src/ui/token-controls.ts`
- Modify: `src/main.ts`

**Step 1: Create token-control helper**

Create `src/ui/token-controls.ts`:

```ts
import { MODULE_ID } from '../constants';
import { MortalityPanel } from './mortality-panel';

export function registerTokenControls(): void {
  Hooks.on('getSceneControlButtons', (controls: unknown[]) => {
    if (!game.user?.isGM) return;

    const tokenControls = controls.find((control: any) => control.name === 'token') as any;
    if (!tokenControls) return;

    tokenControls.tools.push({
      name: `${MODULE_ID}-open-panel`,
      title: 'Grim Arithmetic',
      icon: 'fas fa-skull',
      button: true,
      onClick: () => new MortalityPanel().render(true)
    });
  });
}
```

**Step 2: Wire it in `src/main.ts`**

```ts
import { MODULE_ID, MODULE_TITLE } from './constants';
import { registerSettings } from './settings';
import { registerTokenControls } from './ui/token-controls';
import { MortalityPanel } from './ui/mortality-panel';

Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing`);
  registerSettings();
  registerTokenControls();
});

Hooks.once('ready', () => {
  if (!game.user?.isGM) return;

  game.modules.get(MODULE_ID)!.api = {
    openPanel: () => new MortalityPanel().render(true)
  };
});
```

**Step 3: Verify**

```bash
npm run build
```

Manual Foundry smoke test:

- Enable module.
- Open a PF2e world as GM.
- Confirm skull button appears in token controls.
- Click it.
- Confirm placeholder panel opens.
- Log in as non-GM if practical and confirm button does not appear.

**Step 4: Commit**

```bash
git add src/main.ts src/ui/token-controls.ts dist/
git commit -m "feat: add GM token-control entry point"
```

---

## Milestone D — PF2e Adapter MVP

### Task D1: Define adapter interfaces

**Objective:** Define stable snapshots that decouple Foundry actor data from the math engine.

**Files:**

- Create: `src/systems/base-adapter.ts`

**Step 1: Create interfaces**

Create `src/systems/base-adapter.ts`:

```ts
export interface CombatantSnapshot {
  id: string;
  name: string;
  disposition: 'pc' | 'ally' | 'enemy' | 'neutral';
  hp: {
    current: number;
    max: number;
    temp?: number;
  };
  defenses: {
    ac: number;
    fort?: number;
    reflex?: number;
    will?: number;
  };
  deathState?: {
    dying?: number;
    wounded?: number;
    doomed?: number;
    heroPoints?: number;
  };
  traits: string[];
  assumptions: string[];
}

export interface AttackSnapshot {
  id: string;
  name: string;
  attackBonus: number;
  damageFormula: string;
  traits: string[];
  mapType: 'normal' | 'agile' | 'none' | 'unknown';
  assumptions: string[];
}

export interface SystemAdapter {
  id: string;
  label: string;
  getCombatantFromToken(token: Token): CombatantSnapshot | null;
  getAttacksFromToken(token: Token): AttackSnapshot[];
}
```

**Step 2: Verify build**

```bash
npm run build
```

Expected:

- Build may fail if Foundry types are unavailable. If so, add temporary loose types:

```ts
type Token = any;
```

near the top of the file and document that Foundry type definitions are a future improvement.

**Step 3: Commit**

```bash
git add src/systems/base-adapter.ts
git commit -m "feat: define system adapter snapshots"
```

---

### Task D2: Implement PF2e combatant extraction

**Objective:** Read basic PC/NPC HP, AC, saves, dying/wounded/doomed from PF2e actors.

**Files:**

- Create: `src/systems/pf2e-adapter.ts`
- Modify: `src/systems/base-adapter.ts` if loose Foundry types are needed

**Step 1: Implement defensive extraction**

Create `src/systems/pf2e-adapter.ts`:

```ts
import { CombatantSnapshot, SystemAdapter, AttackSnapshot } from './base-adapter';

export class Pf2eAdapter implements SystemAdapter {
  id = 'pf2e';
  label = 'Pathfinder Second Edition';

  getCombatantFromToken(token: any): CombatantSnapshot | null {
    const actor = token?.actor;
    if (!actor) return null;

    const system = actor.system ?? {};
    const hp = system.attributes?.hp;
    const ac = system.attributes?.ac?.value;

    if (typeof hp?.value !== 'number' || typeof hp?.max !== 'number' || typeof ac !== 'number') {
      return null;
    }

    return {
      id: token.id ?? actor.id,
      name: token.name ?? actor.name,
      disposition: actor.type === 'character' ? 'pc' : token.document?.disposition === -1 ? 'enemy' : 'neutral',
      hp: {
        current: hp.value,
        max: hp.max,
        temp: typeof hp.temp === 'number' ? hp.temp : undefined
      },
      defenses: {
        ac,
        fort: system.saves?.fortitude?.value,
        reflex: system.saves?.reflex?.value,
        will: system.saves?.will?.value
      },
      deathState: {
        dying: actor.itemTypes?.condition?.find((c: any) => c.slug === 'dying')?.value ?? 0,
        wounded: actor.itemTypes?.condition?.find((c: any) => c.slug === 'wounded')?.value ?? 0,
        doomed: actor.itemTypes?.condition?.find((c: any) => c.slug === 'doomed')?.value ?? 0,
        heroPoints: system.resources?.heroPoints?.value
      },
      traits: Array.from(system.traits?.value ?? []),
      assumptions: []
    };
  }

  getAttacksFromToken(_token: any): AttackSnapshot[] {
    return [];
  }
}
```

**Step 2: Verify**

```bash
npm run build
```

Expected:

- Build passes.

**Step 3: Manual Foundry debug check**

Temporary browser console snippet after module load:

```js
const token = canvas.tokens.controlled[0];
// later once exported/wired: game.modules.get('grim-arithmetic').api.debugToken(token)
```

Actual API wiring comes in later tasks.

**Step 4: Commit**

```bash
git add src/systems/pf2e-adapter.ts
git commit -m "feat: extract PF2e combatant snapshots"
```

---

### Task D3: Implement first-pass PF2e Strike extraction

**Objective:** Extract at least one Strike-like attack from a PF2e NPC token.

**Files:**

- Modify: `src/systems/pf2e-adapter.ts`

**Important:** PF2e actor internals can vary by system version. Implement this defensively and log assumptions rather than crashing.

**Step 1: Inspect real PF2e actor shape**

In a Foundry v13 PF2e world, select an NPC and run:

```js
const actor = canvas.tokens.controlled[0].actor;
console.log(actor.system.actions);
console.log(actor.system.melee);
console.log(actor.items.filter(i => i.type === 'melee').map(i => i.toObject()));
```

Record actual useful paths in a local note or in comments if needed.

**Step 2: Implement extraction**

Start with item-based melee extraction if available:

```ts
getAttacksFromToken(token: any): AttackSnapshot[] {
  const actor = token?.actor;
  if (!actor) return [];

  const meleeItems = actor.items?.filter?.((item: any) => item.type === 'melee') ?? [];

  return meleeItems
    .map((item: any): AttackSnapshot | null => {
      const system = item.system ?? {};
      const bonus = system.bonus?.value ?? system.attack?.value;
      const damage = system.damageRolls
        ? Object.values(system.damageRolls)[0] as any
        : null;
      const damageFormula = damage?.damage ?? damage?.formula;

      if (typeof bonus !== 'number' || typeof damageFormula !== 'string') return null;

      const traits = Array.from(system.traits?.value ?? []) as string[];

      return {
        id: item.id,
        name: item.name,
        attackBonus: bonus,
        damageFormula,
        traits,
        mapType: traits.includes('agile') ? 'agile' : 'normal',
        assumptions: ['PF2e Strike extraction is first-pass and may miss conditional modifiers.']
      };
    })
    .filter((attack: AttackSnapshot | null): attack is AttackSnapshot => attack !== null);
}
```

**Step 3: Verify**

```bash
npm run build
```

Manual Foundry check should confirm at least one NPC Strike is extracted.

**Step 4: Commit**

```bash
git add src/systems/pf2e-adapter.ts
git commit -m "feat: extract first-pass PF2e strikes"
```

---

## Milestone E — Wire Engine to UI

### Task E1: Add selected-token and target resolution

**Objective:** Determine selected PC and targeted enemy for the panel.

**Files:**

- Create: `src/foundry/selection.ts`
- Modify: `src/ui/mortality-panel.ts`

**Step 1: Create selection helper**

Create `src/foundry/selection.ts`:

```ts
export interface TokenSelectionResult {
  subjectToken: any | null;
  enemyToken: any | null;
  errors: string[];
}

export function getCurrentTokenSelection(): TokenSelectionResult {
  const controlled = canvas.tokens?.controlled ?? [];
  const targets = Array.from(game.user?.targets ?? []) as any[];
  const errors: string[] = [];

  const subjectToken = controlled.length === 1 ? controlled[0] : null;
  const enemyToken = targets.length === 1 ? targets[0] : null;

  if (!subjectToken) errors.push('Select exactly one PC token.');
  if (!enemyToken) errors.push('Target exactly one enemy token.');

  return { subjectToken, enemyToken, errors };
}
```

**Step 2: Use helper in panel data**

Modify `src/ui/mortality-panel.ts` to call selection helper and display errors before calculation.

**Step 3: Verify**

```bash
npm run build
```

Manual Foundry check:

- no selected token → panel shows selection error
- selected one PC, no target → target error
- selected one PC and target one enemy → proceeds to next-stage placeholder

**Step 4: Commit**

```bash
git add src/foundry/selection.ts src/ui/mortality-panel.ts
git commit -m "feat: resolve selected PC and targeted enemy"
```

---

### Task E2: Calculate and render immediate down risk

**Objective:** Display real immediate down-risk results for selected PC vs targeted enemy.

**Files:**

- Modify: `src/ui/mortality-panel.ts`
- Modify: `templates/mortality-panel.hbs`
- Modify: `styles/grim-arithmetic.css`

**Step 1: Wire adapter and engine**

Panel logic:

1. Get selected PC token and targeted enemy token.
2. Use `Pf2eAdapter` to extract combatant snapshots.
3. Use first extracted enemy attack.
4. Call `immediateDownRisk`.
5. Render result.

**Step 2: Update template to show results**

Template should include:

- subject name
- enemy name
- attack name
- down probability
- risk label
- expected HP after turn
- hit/crit chance per Strike
- assumptions
- not modeled
- permanent death caveat

**Step 3: Verify**

```bash
npm run build
```

Manual Foundry check:

- Select PC token.
- Target NPC token.
- Open panel.
- Confirm a result appears or clear extraction error appears.

**Step 4: Commit**

```bash
git add src/ui/mortality-panel.ts templates/mortality-panel.hbs styles/grim-arithmetic.css
git commit -m "feat: render selected-token down risk"
```

---

### Task E3: Add MVP controls for assumptions

**Objective:** Allow GM to choose simple assumptions without editing code.

**Files:**

- Modify: `src/ui/mortality-panel.ts`
- Modify: `templates/mortality-panel.hbs`

Controls:

- Strike count: 1 / 2 / 3
- MAP: auto / normal / agile / none
- Shield AC bonus: 0 / +1 / +2
- Wounded override: current / 0 / 1 / 2 / 3, display only for now if not used in down math

**Step 1: Add form controls to template**

Use Foundry form inputs and event listeners.

**Step 2: Add event listeners**

In `activateListeners`, re-render panel when assumptions change.

**Step 3: Verify**

Manual Foundry check:

- Change Strike count.
- Result updates.
- Change MAP.
- Result updates.
- Change shield bonus.
- AC changes and result updates.

**Step 4: Commit**

```bash
git add src/ui/mortality-panel.ts templates/mortality-panel.hbs
git commit -m "feat: add immediate-risk assumption controls"
```

---

## Milestone F — Documentation and Smoke Testing

### Task F1: Update README with development workflow

**Objective:** Document how to build, test, install locally, and run the MVP.

**Files:**

- Modify: `README.md`

Add sections:

- Requirements
- Install dependencies
- Build
- Test
- Local Foundry development install
- How to open Grim Arithmetic in Foundry
- MVP limitations
- Permanent death probability roadmap note

**Step 1: Update README**

Include local install recommendation:

```bash
ln -s /Users/kyle/git/grim-arithmetic "$HOME/Library/Application Support/FoundryVTT/Data/modules/grim-arithmetic"
```

**Step 2: Verify commands**

```bash
npm run check
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add development workflow"
```

---

### Task F2: Add MVP limitation notes to PRD if needed

**Objective:** Keep PRD aligned with implementation discoveries.

**Files:**

- Modify: `PRD.md` if actual PF2e actor extraction reveals important constraints.

**Step 1: Patch PRD only if needed**

Examples of discoveries worth documenting:

- PF2e attack bonus path differs from expected.
- Damage formula extraction needs Foundry roll objects.
- Foundry v13 API requires different hook names.

**Step 2: Commit if changed**

```bash
git add PRD.md
git commit -m "docs: update PRD with implementation notes"
```

---

### Task F3: Manual Foundry v13.351 smoke test

**Objective:** Verify module loads and MVP panel works in real Foundry.

**Files:**

- Create: `docs/testing/foundry-v13-smoke-test.md`

**Step 1: Create smoke test doc**

Record:

- Foundry version/build
- PF2e system version
- browser used
- test world name
- module version/commit
- selected PC fixture
- targeted NPC fixture
- observed result
- console errors, if any

**Step 2: Suggested smoke test checklist**

```md
# Foundry v13 Smoke Test

- [ ] Module appears in Manage Modules
- [ ] Module enables without server-side manifest error
- [ ] World loads without browser console errors
- [ ] Skull button appears for GM
- [ ] Skull button does not appear for non-GM
- [ ] Panel opens
- [ ] Empty selection shows useful error
- [ ] Selected PC + targeted NPC produces result
- [ ] Changing Strike count updates result
- [ ] Changing MAP updates result
- [ ] Permanent death is clearly marked as not modeled in MVP
```

**Step 3: Commit**

```bash
git add docs/testing/foundry-v13-smoke-test.md
git commit -m "docs: add Foundry v13 smoke test checklist"
```

---

## Recommended First Implementation Sequence

Do these first, in order:

1. A1 — project metadata
2. A2 — TypeScript/Vite/Vitest config
3. A3 — Foundry module manifest
4. B1 — degree-of-success engine
5. B2 — attack probabilities
6. B3 — average damage parser
7. B4 — immediate down risk
8. B5 — cumulative Strike damage
9. C1 — settings
10. C2 — GM panel shell
11. C3 — token-control button
12. D1–D3 — PF2e adapter
13. E1–E3 — wire UI to engine
14. F1–F3 — docs and smoke test

This sequence intentionally gets a loadable module early, then makes the math trustworthy before trying to extract complex PF2e actor data.

---

## Post-MVP Backlog

Do not implement these until MVP is working:

- exact dice distribution instead of average-damage approximation
- deadly/fatal traits
- resistance/weakness/immunity handling
- persistent damage
- recovery checks
- Hero Point behavior
- Battle Medicine / healing behavior
- Champion reactions
- Shield Block automation
- encounter-wide risk matrix
- Monte Carlo simulation
- tactics profiles
- permanent death probability
- Foundry v14 compatibility
- SF2e adapter

---

## Definition of Done for MVP Scaffold

The MVP scaffold is done when:

- `npm run check` passes.
- Module appears and enables in Foundry v13.351+.
- GM sees a skull/token-control button.
- GM can open Grim Arithmetic panel.
- Panel gives useful errors when token selection is incomplete.
- Panel computes selected PC vs targeted enemy down risk for at least one PF2e NPC Strike.
- Output shows assumptions and not-modeled caveats.
- Permanent death probability is clearly deferred.
- README explains local install and limitations.
- Smoke test checklist is filled out for at least one v13.351 world.

---

## Notes for Future Nova

- Booga prefers the architect-first path: PRD → implementation plan → scaffold → tests → features.
- Use `gpt-5.5/openai-codex` as the core coding/architecture/review lane.
- Use Rowan only for optional repo inspection or low-risk grunt work, not core architecture or final review.
- Keep “Grim Arithmetic” evocative, but keep the math conservative and explainable.
- Skull icon is mandatory. Obviously.
