# Grim Arithmetic — Product Requirements Document

> **Project:** Foundry VTT add-on module for probabilistic encounter mortality analysis  
> **Working tagline:** *Foundry knows how hard the encounter is. Grim Arithmetic tells you who might not walk away.*  
> **Initial platform target:** Foundry VTT **v13 Build 351 minimum**  
> **Later compatibility target:** Foundry VTT v14  
> **Initial game system target:** Pathfinder 2e (`pf2e`) on Foundry v13  
> **Future system target:** Starfinder 2e (`sf2e`) once Foundry v14 compatibility work begins

---

## 1. Executive Summary

Grim Arithmetic is a GM-facing Foundry VTT module that estimates the probability of severe outcomes in tactical combat: being downed, dying, permanent character death, and party-level collapse risk. Instead of only reporting encounter budget or XP difficulty, it uses actual combatant state—current HP, max HP, AC, saves, dying/wounded values, enemy attacks, expected damage, and encounter composition—to surface practical mortality risk.

The module should begin as a **transparent, conservative decision-support tool** rather than an oracle. Its earliest versions will focus on explaining *why* a character is at risk and which assumptions drive the estimate. Later versions can add richer Monte Carlo simulations, spell/action modeling, AI-like tactics profiles, and SF2e support.

---

## 2. Problem Statement

Foundry and PF2e already provide excellent tactical automation and encounter-budget guidance, but GMs still lack an immediate answer to questions like:

- “Can this monster one-round the wounded caster?”
- “Is this Severe encounter actually lethal for this party composition?”
- “How much does Raise Shield reduce the fighter’s chance of dropping?”
- “If the boss wins initiative and crits, what is the real risk?”
- “Is there a meaningful chance of permanent death, or just temporary danger?”

PF2e encounter difficulty categories are useful, but they do not fully capture:

- current HP instead of max HP
- wounded/dying state
- crit-heavy enemy profiles
- focus-fire behavior
- persistent damage
- healer availability
- hero points
- bad initiative order
- multiple enemies targeting the same PC
- party-specific mitigation like Champion reactions, Battle Medicine, shields, resistances, and healing

Grim Arithmetic fills that gap by giving GMs a live mortality lens.

---

## 3. Goals

### 3.1 MVP Goals

The MVP should answer:

1. For a selected PC and selected enemy, what is the probability that the enemy’s next turn downs the PC?
2. What is the probability that the PC reaches or worsens a dying state under simple assumptions?
3. Which enemy action or damage profile is the biggest immediate risk driver?
4. How do key toggles change the result?
   - enemy uses 1, 2, or 3 Strikes
   - Multiple Attack Penalty applies
   - PC has Raise Shield / shield bonus
   - PC is Wounded 0/1/2/3
   - PC has a Hero Point available
5. Present results in a way that makes assumptions obvious and prevents overconfidence.

### 3.2 Post-MVP Goals

1. Multi-combatant encounter simulation.
2. Party-level risk metrics.
3. Permanent death probability estimate.
4. Spell and save-based threat modeling.
5. Persistent damage and recovery check modeling.
6. Configurable enemy tactics profiles.
7. Encounter comparison and “what changed?” analysis.
8. Foundry v14 compatibility.
9. Starfinder 2e support after v14 readiness.

---

## 4. Non-Goals

For the initial MVP, Grim Arithmetic should **not** attempt to:

- perfectly simulate all PF2e rules
- replace GM judgment
- automate enemy turns
- provide player-facing tactical advice by default
- optimize player actions like a video-game combat solver
- model every feat, reaction, resistance, immunity, or spell
- guarantee exact lethal probability under all circumstances
- support Foundry v14 as the first compatibility baseline
- support SF2e in the first release, since current SF2e Foundry support requires v14+

---

## 5. Users and Use Cases

### 5.1 Primary User: GM

The GM wants a fast, private risk read while designing or running encounters.

Use cases:

- During prep: “Is this boss too swingy for my party?”
- During combat: “If this creature attacks Seam, is that likely to kill him?”
- Before using a high-damage action: “Is this dramatic or unfair?”
- Encounter tuning: “Would reducing the boss attack bonus by 1 meaningfully reduce death risk?”

### 5.2 Secondary User: System/Module Developer

A developer wants a clean mortality engine that can be tested outside Foundry and integrated into Foundry UI.

Use cases:

- Unit test probability math.
- Add new PF2e mechanics incrementally.
- Create fixtures from real actor/token data.
- Validate results against Monte Carlo simulation.

### 5.3 Optional Future User: Player

Players may eventually see limited risk indicators if the GM enables them.

Default should be **GM-only** to avoid metagaming and table anxiety.

---

## 6. Product Principles

1. **Transparent over magical**  
   Always show assumptions and drivers. A GM should know what the estimate includes and excludes.

2. **Useful before perfect**  
   A rough, explainable danger estimate is valuable if clearly caveated.

3. **GM-first, not player-punishing**  
   The module should help the GM calibrate drama, not encourage adversarial play.

4. **Local and deterministic where possible**  
   Core calculations should run locally in Foundry with no cloud dependency.

5. **Rules-aware but modular**  
   PF2e support should be implemented as a system adapter. The mortality engine should not be hardwired to one system forever.

6. **Testable outside Foundry**  
   Probability and simulation code should be pure TypeScript/JavaScript where possible so it can be unit tested without launching Foundry.

---

## 7. Compatibility Requirements

### 7.1 Foundry Version

- Minimum: **Foundry VTT v13 Build 351**
- Initial verified target: v13.351+
- Later target: Foundry v14

The module manifest should declare Foundry v13 compatibility initially. A later compatibility branch/release should update manifest and API shims for v14.

### 7.2 Game System

Initial target:

- `pf2e` system on Foundry v13

Future target:

- `sf2e` system on Foundry v14+

Note: SF2e support should be treated as a later milestone because known SF2e Foundry support requires v14+.

---

## 8. Functional Requirements

### 8.1 Module Activation

- The module can be installed and enabled in a Foundry v13 world.
- The module should expose a GM-only entry point from one or more of:
  - token controls
  - combat tracker button
  - scene/token context menu
  - configurable hotkey

### 8.2 Token Selection Flow

MVP flow:

1. GM selects one PC token.
2. GM targets or selects one enemy token.
3. GM opens Grim Arithmetic panel.
4. Module reads current actor/token data.
5. Module displays immediate-risk estimates.

Alternative flow:

- If a combat encounter exists, the panel can show all PCs and all hostile NPCs in the current combat, but MVP calculations may still be one PC vs one enemy.

### 8.3 Data Extraction: PC

The PF2e adapter should attempt to read:

- actor name
- current HP
- max HP
- temporary HP if available
- AC
- Fortitude DC/modifier
- Reflex DC/modifier
- Will DC/modifier
- dying value
- wounded value
- doomed value, if available
- hero points, if available
- shield status or AC bonus assumption, if available
- resistances/weaknesses/immunities, if safely accessible

MVP may mark unavailable fields as “not modeled.”

### 8.4 Data Extraction: Enemy

The PF2e adapter should attempt to read:

- actor name
- attack actions / strikes
- attack bonus
- damage formula/components
- traits relevant to damage or critical effects
- spellcasting DCs, if available
- save-based damage actions, post-MVP

MVP can focus on Strike-like attacks only.

### 8.5 Hit and Crit Probability

The engine must calculate d20 outcome probabilities for:

- critical success
- success
- failure
- critical failure

For Strike attacks:

- natural 20 improves degree of success by one step
- natural 1 worsens degree of success by one step
- attack total compared against AC
- critical success at AC + 10
- critical failure at AC - 10, where relevant

For MVP, output should include:

- hit chance
- crit chance
- miss chance
- expected damage per Strike

### 8.6 Multiple Attack Penalty

MVP should support a simple enemy turn model:

- one Strike
- two Strikes
- three Strikes

MAP assumptions:

- normal weapon/action: 0 / -5 / -10
- agile weapon/action: 0 / -4 / -8
- if unknown, default to normal MAP and display that assumption

### 8.7 Damage Modeling

MVP should model:

- average damage from dice formulas
- critical damage as doubled damage, with caveats for precision/deadly/fatal if not implemented
- minimum/maximum damage range if easy to parse
- probability of reducing PC to 0 HP after the enemy turn

Post-MVP:

- exact dice distribution convolution
- deadly/fatal traits
- persistent damage
- splash damage
- precision damage rules
- resistance/weakness application
- immunity handling
- critical specialization effects

### 8.8 Down Probability

The MVP must calculate:

- probability PC is reduced to 0 HP or below after one enemy Strike
- probability PC is reduced to 0 HP or below after a selected enemy turn sequence
- expected remaining HP after the sequence
- major risk drivers

Example output:

```text
Mira Stormwake vs Troll Mauler
Enemy turn model: 2 Strikes, normal MAP
Down chance this enemy turn: 18%
Crit-driven down chance: 11%
Expected HP after turn: 9.4
Main risk driver: first Strike crit
Assumptions: no resistance, no shield block, no healing before next turn
```

### 8.9 Dying Risk

MVP should estimate simple dying-state risk:

- if PC is above 0 HP, chance of reaching dying 1 or dying 2 from a hit/crit
- if PC is already dying, chance of worsening from taking damage
- account for wounded value when entering dying if the system data is available
- account for doomed if available

This should be clearly labeled as a simplified model unless full recovery-check and initiative-order modeling is enabled.

### 8.10 Permanent Death Risk

MVP may include a placeholder or experimental estimate, but permanent death should probably be a post-MVP feature.

Permanent death requires modeling:

- dying threshold
- wounded/doomed
- recovery checks
- persistent damage timing
- healer initiative order
- hero points
- party intervention likelihood
- enemy behavior toward downed PCs
- resurrection availability / campaign assumptions

Recommendation: MVP should display:

```text
Permanent death probability: Not modeled in MVP
Near-term lethal pressure: Low / Moderate / High
Reason: PC can be downed by a crit, but death requires additional failed recovery or follow-up damage.
```

Post-MVP permanent death modes:

- **Strict encounter death:** PC reaches death threshold during encounter.
- **Permanent campaign death:** PC reaches death threshold and no configured recovery/revival path exists.
- **Narrative-safe mode:** assumes enemies do not attack downed PCs unless configured.

### 8.11 Multi-Combatant Encounter Risk

Post-MVP should support encounter-wide metrics:

- probability any PC is downed
- probability any PC dies
- probability of permanent death
- probability of TPK
- most endangered PC
- most dangerous enemy
- expected party HP loss per round
- expected rounds to first down
- risk by initiative order

This likely requires Monte Carlo simulation.

### 8.12 Simulation Engine

Post-MVP simulation engine should:

- run locally in-browser
- allow configurable iteration count, e.g. 1,000 / 5,000 / 10,000 simulations
- avoid blocking the Foundry UI for too long
- optionally use Web Workers if needed
- expose seedable deterministic test runs
- support simplified tactics profiles

Example enemy tactics profiles:

- **Spread damage:** enemies avoid attacking downed targets and distribute attacks.
- **Focus fire:** enemies concentrate attacks on the weakest reachable PC.
- **Predator:** enemies prioritize wounded/downed targets.
- **Boss cinematic:** boss uses strongest action first, then MAP attacks.
- **Random legal:** useful baseline for testing.

---

## 9. UI Requirements

### 9.1 Main Panel

The UI should be compact and GM-readable during play.

Suggested sections:

1. Header: selected PC vs selected enemy
2. Risk summary
3. Enemy turn assumptions
4. Probability breakdown
5. Main risk drivers
6. Toggles/what-if controls
7. Caveats / not-modeled list

### 9.2 Risk Labels

Use both percentages and labels:

- 0–5%: Low
- 5–15%: Guarded
- 15–35%: Dangerous
- 35–60%: Severe
- 60%+: Grim

Labels should be configurable later.

### 9.3 GM-Only Defaults

- UI should default to GM-only visibility.
- No player-facing chat messages by default.
- Optional future setting: allow players to see limited risk labels for their own token.

### 9.4 Explainability

Every estimate should include assumptions, such as:

- “Using average damage, not full dice distribution.”
- “Resistance not modeled.”
- “Assumes enemy uses 2 Strikes.”
- “Assumes no healing before enemy completes turn.”
- “Assumes normal MAP.”

---

## 10. Settings Requirements

Initial settings:

- Enable/disable module button in combat tracker.
- Default enemy turn model: 1 / 2 / 3 Strikes.
- Default MAP type: auto / normal / agile.
- Show percentages: yes/no.
- Show risk labels: yes/no.
- GM-only mode: locked on for MVP.
- Debug logging: off by default.

Future settings:

- Monte Carlo iterations.
- Default tactics profile.
- Permanent death mode.
- Hero Point behavior.
- Healing behavior.
- Enemy attacks downed PCs: never / only mindless / tactical / always.
- Include persistent damage.
- Include resistances/weaknesses.

---

## 11. Technical Architecture Recommendation

### 11.1 Repository Layout

Recommended initial structure:

```text
grim-arithmetic/
├── PRD.md
├── README.md
├── module.json
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── ui/
│   │   └── mortality-panel.ts
│   ├── engine/
│   │   ├── degree-of-success.ts
│   │   ├── dice.ts
│   │   ├── damage.ts
│   │   ├── mortality.ts
│   │   └── simulation.ts
│   └── systems/
│       ├── base-adapter.ts
│       └── pf2e-adapter.ts
├── styles/
│   └── grim-arithmetic.css
├── templates/
│   └── mortality-panel.hbs
├── tests/
│   ├── degree-of-success.test.ts
│   ├── damage.test.ts
│   └── mortality.test.ts
└── dist/
    └── grim-arithmetic.js
```

### 11.2 Core Design

Separate concerns:

- **Foundry integration layer:** hooks, UI, settings, token selection.
- **System adapter layer:** PF2e actor/token extraction.
- **Mortality engine:** pure functions for probability and damage math.
- **Simulation engine:** post-MVP Monte Carlo.

This keeps probability math testable without Foundry.

### 11.3 Language and Build

Recommended:

- TypeScript
- Vite or esbuild for bundling
- Vitest for unit tests
- ESLint + Prettier

Rationale:

- Foundry modules are browser JavaScript.
- TypeScript helps tame PF2e actor data shapes.
- Vitest makes pure engine tests easy.

---

## 12. Data Model Sketch

### 12.1 Combatant Snapshot

```ts
interface CombatantSnapshot {
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
  traits?: string[];
  assumptions: string[];
}
```

### 12.2 Attack Snapshot

```ts
interface AttackSnapshot {
  id: string;
  name: string;
  attackBonus: number;
  damageFormula: string;
  traits: string[];
  mapType: 'normal' | 'agile' | 'none' | 'unknown';
  criticalEffectsMode: 'simple-double' | 'modeled';
  assumptions: string[];
}
```

### 12.3 Risk Result

```ts
interface MortalityRiskResult {
  subjectName: string;
  enemyName: string;
  turnModel: string;
  downProbability: number;
  dyingEntryProbability?: number;
  deathProbability?: number;
  permanentDeathProbability?: number;
  expectedHpAfterTurn: number;
  hitChanceByStrike: number[];
  critChanceByStrike: number[];
  riskLabel: 'Low' | 'Guarded' | 'Dangerous' | 'Severe' | 'Grim';
  topRiskDrivers: string[];
  assumptions: string[];
  notModeled: string[];
}
```

---

## 13. Milestones

### Milestone 0 — Product and Scaffold

Deliverables:

- PRD
- README
- module manifest draft
- package/build setup
- empty Foundry module loading in v13.351

Acceptance criteria:

- Repo is initialized.
- `module.json` has minimum Foundry compatibility v13 / build 351 intent.
- Module appears in Foundry Manage Modules.
- No runtime errors on world load.

### Milestone 1 — Pure Probability Engine

Deliverables:

- degree-of-success calculator
- hit/crit probability calculator
- average dice damage parser
- simple one-Strike down probability
- unit tests

Acceptance criteria:

- Tests cover natural 1/20 degree shifts.
- Tests cover hit/crit thresholds.
- Tests cover average damage from common formulas like `2d8+6`.
- Tests cover down probability for deterministic sample cases.

### Milestone 2 — PF2e Adapter MVP

Deliverables:

- Extract PC HP/AC/wounded/dying from selected token.
- Extract enemy Strike attack bonus and damage formula where available.
- Mark unsupported fields as assumptions/not-modeled.

Acceptance criteria:

- Works on at least 3 representative PF2e NPCs.
- Works on at least 2 representative PCs.
- Fails gracefully if actor data is missing.

### Milestone 3 — GM Risk Panel MVP

Deliverables:

- GM-only panel.
- Selected PC vs selected enemy risk display.
- 1/2/3 Strike toggle.
- MAP toggle.
- Shield bonus toggle.
- Wounded value override.

Acceptance criteria:

- GM can open panel during combat.
- Results update when toggles change.
- Assumptions are visible.
- No player-facing output by default.

### Milestone 4 — Encounter Snapshot View

Deliverables:

- Show all PCs in active combat.
- Show all hostile NPCs in active combat.
- Compute pairwise immediate down risk.
- Highlight most endangered PC and most dangerous enemy.

Acceptance criteria:

- Encounter snapshot loads within a reasonable time.
- Output remains readable for 4 PCs and up to 8 enemies.

### Milestone 5 — Monte Carlo Prototype

Deliverables:

- Simple encounter simulator.
- Configurable iterations.
- Seeded tests.
- Basic tactics profiles.

Acceptance criteria:

- Reports any-PC-down chance and expected rounds to first down.
- Results are stable enough across repeated runs.
- Simulation limitations are shown.

### Milestone 6 — Death and Permanent Death Modeling

Deliverables:

- Recovery checks.
- Dying/wounded/doomed thresholds.
- Hero Point behavior.
- Persistent damage timing.
- Permanent death modes.

Acceptance criteria:

- Clearly distinguishes down, death, and permanent death.
- GM can configure campaign assumptions.
- Results include caveats and driver analysis.

### Milestone 7 — Foundry v14 and SF2e Track

Deliverables:

- Foundry v14 compatibility review.
- Manifest/API updates.
- SF2e adapter research.
- SF2e support if data model access is compatible.

Acceptance criteria:

- Module loads in Foundry v14.
- PF2e still works.
- SF2e target support is either implemented or documented with blockers.

---

## 14. MVP Acceptance Criteria

The first usable MVP is complete when:

1. Grim Arithmetic loads as a Foundry v13.351+ module.
2. GM can select one PC and one enemy.
3. Module reads current HP and AC for the PC.
4. Module reads at least one enemy Strike attack bonus and damage formula.
5. Module computes hit chance, crit chance, expected damage, and down probability.
6. Module supports 1/2/3 Strike assumptions with MAP.
7. Module displays a risk label and top assumptions.
8. Module has unit tests for core probability math.
9. Module does not expose GM-only estimates to players by default.
10. README documents setup, limitations, and development commands.

---

## 15. Risks and Mitigations

### Risk: PF2e Actor Data Shape Changes

Mitigation:

- Keep PF2e extraction isolated in `pf2e-adapter.ts`.
- Add debug snapshot export for anonymized actor data.
- Add adapter tests using fixture JSON.

### Risk: Estimates Feel Too Precise

Mitigation:

- Show assumptions prominently.
- Use labels plus percentages.
- Mark experimental features clearly.
- Avoid permanent death percentages until model is robust.

### Risk: UI Causes Metagaming

Mitigation:

- GM-only by default.
- No chat output by default.
- Future player mode must be opt-in.

### Risk: Monte Carlo Is Slow

Mitigation:

- Start with immediate-turn analytic calculations.
- Add Web Workers later.
- Limit default iterations.
- Cache extracted snapshots.

### Risk: Foundry v13/v14 API Differences

Mitigation:

- Build for v13 first.
- Avoid unnecessary dependency on unstable internals.
- Maintain compatibility shims.
- Add v14 as a distinct milestone.

---

## 16. Open Questions

1. Should the initial module support only active combatants, or any selected tokens on a scene?
2. Should “permanent death probability” be hidden until post-MVP, or shown as “not modeled yet” from day one?
3. Should the UI appear in the combat tracker, token HUD, or as a standalone application window first?
4. Should player-facing risk labels ever be supported?
5. How much should the module account for GM intent, such as enemies avoiding downed PCs?
6. Should the module store encounter reports in Journals, or keep analysis ephemeral?
7. Should the project use TypeScript from day one, or plain JavaScript for easier Foundry iteration?

Recommendation: use TypeScript from day one, keep the MVP GM-only, and begin with selected-token analysis before encounter-wide modeling.

---

## 17. Recommended Next Steps

1. Create initial repository scaffold.
2. Add `module.json` targeting Foundry v13.351+.
3. Add TypeScript build/test tooling.
4. Implement and test the pure degree-of-success calculator.
5. Implement and test average dice damage parsing.
6. Implement simple down-probability calculation.
7. Add a minimal Foundry panel that displays manually entered values.
8. Replace manual values with PF2e token extraction.
9. Iterate with real PF2e actors in a Foundry v13 test world.

---

## 18. Additional Recommendations

### 18.1 Start With “Immediate Threat,” Not Full Encounter Simulation

The fastest path to a useful module is answering:

> “If this enemy takes its next turn against this PC, how bad could it get?”

That avoids premature complexity while still being immediately valuable.

### 18.2 Keep the Math Engine Foundry-Agnostic

The core engine should not import Foundry globals. This will make unit tests and future reuse much cleaner.

### 18.3 Treat Permanent Death as a Named Later Milestone

Permanent death is the cool headline feature, but it depends on many table assumptions. Build trust first with down/chance-to-dying estimates.

### 18.4 Design for “Assumptions as First-Class Output”

Every result should include `assumptions` and `notModeled`. This protects against false precision and will make the module feel trustworthy.

### 18.5 Save Real-World Test Fixtures Early

Once the scaffold exists, create anonymized fixture snapshots from:

- a low-level PC
- a mid-level PC
- a boss monster
- a multiattack brute
- a spellcaster NPC

These fixtures will become the regression suite for future math changes.
