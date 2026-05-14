# Grim Arithmetic Backlog

> **Project:** Grim Arithmetic  
> **Current baseline:** v0.5.0 encounter-wide immediate risk view
> **Target Foundry:** v13 minimum, verified by initial smoke test on Foundry v14.361  
> **Initial system:** Pathfinder 2e (`pf2e`)  
> **Default visibility:** GM-only

Grim Arithmetic is now past the proof-of-life stage: the module can be installed, enabled, opened from Foundry, and used to estimate immediate down-risk for one selected PC against one targeted enemy.

This backlog keeps the next work intentionally phased. The guiding principle is: **make the current estimate trustworthy before making the simulation broader.**

---

## Release principles

1. **Trust before breadth** — strengthen data extraction, UI clarity, and math correctness before full encounter simulation.
2. **Transparent assumptions** — every feature that changes risk output must show what is and is not modeled.
3. **Test the engine outside Foundry** — pure probability/math features require Vitest coverage.
4. **Capture real PF2e data shapes** — when Foundry/PF2e extraction fails, add a fixture and regression test.
5. **No false precision** — permanent death probability remains deferred until dying/recovery/healing/enemy behavior assumptions are explicit.
6. **GM-only by default** — no player-facing output until explicitly designed.
7. **Keep `docs/ARITHMETIC.md` current** — every backlog item that changes a calculation, assumption, caveat, or displayed probability must update the calculation guide in the same commit/PR.

---

## v0.1.0 — Working MVP baseline

**Status:** tagged / baseline candidate

### Included

- Foundry v13 module manifest and build artifact.
- GM-only Grim Arithmetic entry point.
- Token Controls skull button.
- Selected PC + targeted enemy flow.
- PF2e combatant extraction for HP, AC, saves, dying/wounded/doomed, hero points, and traits.
- First-pass PF2e melee Strike extraction.
- Immediate down-risk engine using:
  - d20 degree-of-success rules
  - hit/crit probability
  - 1/2/3 Strike enemy turn model
  - normal/agile/no MAP assumptions
  - average damage parsing
  - cumulative damage across multiple Strikes
- Panel output with:
  - down chance
  - risk label
  - expected HP after modeled turn
  - per-Strike hit/crit chances
  - assumptions and not-modeled caveats
  - permanent death explicitly marked as not modeled
- Installation and testing docs.

### Known limitations

- Uses average damage, not exact dice distributions.
- Picks a supported Strike automatically rather than letting the GM choose.
- PF2e data extraction is based on first-pass real/mock shapes and should be hardened with table-tested fixtures.
- Wounded override is display-only in the MVP.
- No resistance, weakness, immunity, persistent damage, healing, reactions, or Hero Point modeling yet.

---

## v0.1.1 — Table-test hardening and UX polish

**Status:** implemented locally; awaiting Foundry table smoke test / release tag.

**Goal:** Make the existing MVP reliable and pleasant during real session use without expanding the risk model too much.

### Priority: High

#### 1. Normalize repository remote and tag workflow

- Ensure local Mac repo remote is `git@github.com:kyletravis/grim-arithmetic.git`.
- Ensure Foundry server clone remote is `git@github.com:kyletravis/grim-arithmetic.git`.
- Document pushing tags from the repo where the tag exists.
- Consider adding a short `docs/RELEASE.md`.

#### 2. Display module version in the panel

- Read version from a single source if practical.
- Show `Grim Arithmetic vX.Y.Z` in the panel footer or header.
- Helps confirm deployed code during Foundry server tests.

#### 3. Add explicit Refresh / Recalculate button

- Re-run selection resolution and risk calculation on demand.
- Useful after HP changes, targeting changes, or assumption changes.
- Keep auto-refresh deferred until we understand performance and Foundry hook behavior.

#### 4. Add enemy Strike selector

- List supported enemy melee Strikes extracted from the targeted actor.
- Let the GM choose which Strike to model.
- Default to first supported Strike for backward compatibility.
- Preserve selected Strike while changing assumptions when possible.

#### 5. Improve error states

Add clearer user-facing messages for:

- no selected token
- multiple selected tokens
- selected token is not recognized as a PC
- no target
- multiple targets
- targeted token is not recognized as an enemy/NPC
- missing HP or AC
- enemy has no supported melee Strike
- damage formula unsupported by current parser

#### 6. Add debug capture helper

- Add a GM-only debug setting or console-accessible helper that safely logs relevant actor/item data shapes.
- Redact or omit unnecessary actor data.
- Goal: make it easy to produce fixtures when PF2e extraction fails.

#### 7. Add real PF2e fixture tests

- Capture representative actor/item shapes from table testing.
- Add fixtures under `tests/fixtures/`.
- Add regression tests for combatant and Strike extraction.

### Acceptance criteria

- `npm run check` passes.
- Panel shows current module version.
- GM can switch between multiple enemy Strikes.
- Refresh button recalculates after token HP or assumption changes.
- Error states are understandable without reading the browser console.
- Any newly observed PF2e data shape has a regression test.

---

## v0.2.0 — Exact dice distribution engine

**Status:** tagged / baseline candidate.

**Goal:** Replace average-only down-risk with exact damage distributions for supported formulas.

### Priority: High

#### 1. Add dice distribution parser

Support:

- `1d8`
- `2d6+4`
- `1d12 + 1d6 + 3`
- flat modifiers
- whitespace variants

Keep unsupported for now:

- persistent damage tags
- damage type brackets
- conditional damage
- deadly/fatal traits
- precision rules

#### 2. Add distribution convolution

- Compute probability mass functions for dice terms.
- Combine multiple dice groups.
- Apply flat modifiers.
- Produce min, max, mean, and probability by total.

#### 3. Model crit damage with distributions

- For MVP-style crits, double damage totals.
- Explicitly caveat that deadly/fatal/precision/splash are not yet modeled.

#### 4. Update immediate down-risk calculation

- Calculate true probability that one hit/crit downs the PC.
- Calculate true cumulative down probability across 1/2/3 Strikes.
- Preserve expected HP calculation.

#### 5. Update UI output

Show:

- damage range
- average damage
- down chance by exact distribution
- swinginess note if useful

### Acceptance criteria

- Existing average-damage tests are either preserved for mean calculation or replaced with exact distribution tests.
- New tests cover single-die, multi-die, flat modifier, cumulative multi-Strike down-risk, and crit doubling.
- UI caveats clearly say exact dice distribution is used only for supported formulas.

---

## v0.3.0 — Dying, wounded, doomed, and Hero Point pressure

**Status:** implemented locally; awaiting Foundry table smoke test / release tag.

**Goal:** Move from pure down-risk toward immediate mortality pressure without claiming permanent death probability.

### Priority: High / Medium

#### 1. Model entering dying from a downing hit

- Normal hit that drops PC: entering Dying 1 + wounded.
- Critical hit that drops PC: entering Dying 2 + wounded.
- Include doomed in threshold messaging where available.

#### 2. Add immediate death threshold flags

Examples:

- “A crit-down would put this PC at Dying 3.”
- “At Wounded 2, this crit-down is extremely dangerous.”
- “Doomed reduces the death threshold; check table rules.”

#### 3. Add Hero Point assumption toggle

- Display whether actor has hero points if available.
- Add toggle: “Assume Hero Point available for death prevention.”
- Keep behavior conservative and caveated.

#### 4. Rename/expand result sections

Suggested sections:

- Down Chance
- Dying Severity If Downed
- Immediate Death Flag
- Permanent Death: Not Modeled

### Acceptance criteria

- Wounded override affects dying severity output, not just display.
- Hero Point availability is visible and clearly caveated.
- No permanent death percentage is shown.
- Tests cover wounded 0/1/2/3, crit-down, normal down, and doomed threshold messaging.

---

## v0.4.0 — Damage adjustments: resistance, weakness, immunity

**Status:** implemented locally; awaiting Foundry server smoke test / release bundle.

**Goal:** Account for the most common PF2e damage adjustments that materially change down-risk.

### Priority: Medium

#### 1. Extract PC resistances, weaknesses, and immunities

- Read safe PF2e actor fields where available.
- Add fixtures for common structures.
- Fall back gracefully when data is missing or ambiguous.

#### 2. Extract or infer Strike damage type

- Parse basic damage type data from PF2e Strike/item damage rolls.
- Show when damage type is unknown.

#### 3. Apply simple adjustments

- Resistance reduces applicable damage.
- Weakness increases applicable damage.
- Immunity sets applicable damage to zero where confidently matched.

#### 4. Add manual override controls

- Damage type override.
- Resistance value override.
- Weakness value override.
- “Ignore adjustments” toggle.

### Acceptance criteria

- Adjustments are tested with exact distributions.
- UI shows which adjustment was applied and why.
- Ambiguous damage type never silently changes risk.

---

## v0.5.0 — Encounter-wide immediate risk view

**Status:** implemented on feature branch; awaiting Foundry server smoke test before release.

**Goal:** Provide encounter-level insight without full Monte Carlo simulation.

### Implemented

- Read PC tokens and hostile NPC tokens from the active combat encounter (`game.combat.combatants`), with an opt-in scene-token fallback that surfaces a caveat.
- Surface unsupported actors as a caveat list rather than throwing.
- Compute pairwise immediate down-risk for every supported (PC × hostile × Strike) triple by reusing `immediateDownRisk()`.
- Catch per-pair failures so one bad Strike does not poison the whole encounter board.
- Render a ranked danger board: "Most endangered PCs" (each PC once, sorted by their worst threat) and "Most dangerous enemies" (each enemy once, sorted by their worst pair).
- Preserve the existing one PC vs one enemy detail view.
- Add a `MAX_PAIRS = 200` performance guardrail that short-circuits to a skipped board with a clear caveat instead of freezing Foundry on very large scenes.

### Acceptance criteria (met on feature branch)

- Works with current combat encounter.
- Does not require selecting/targeting individual tokens.
- Still supports one PC vs one enemy detail view.
- Clear performance guardrails for large scenes.
- `npm run check` passes.

---

## v0.6.0+ — Monte Carlo encounter simulation

**Goal:** Begin modeling full encounter outcomes using configurable tactics profiles.

### Priority: Future / High complexity

#### Candidate features

- Iteration counts: 1,000 / 5,000 / 10,000.
- Seeded deterministic test runs.
- Optional Web Worker to avoid blocking Foundry UI.
- Initiative-order modeling.
- Multiple enemies and PCs.
- Expected rounds to first down.
- Chance any PC is downed.
- Chance of party collapse / TPK-like outcome.
- Tactics profiles:
  - spread damage
  - focus fire
  - predator
  - boss cinematic
  - random legal

### Acceptance criteria

- Simulation engine is pure/testable outside Foundry.
- Seeded runs produce deterministic results in tests.
- UI never freezes for normal iteration counts.
- Output clearly distinguishes modeled assumptions from real table tactics.

---

## v0.7.0+ — Spells and save-based threat modeling

**Goal:** Add non-Strike enemy threats.

### Candidate features

- Extract spellcasting DCs.
- Model basic save outcomes using PF2e degree-of-success rules.
- Support simple damage spells with basic/reflex/fort/will saves.
- AoE target-count assumptions.
- Incapacitation/control caveats.

---

## v0.8.0+ — Persistent damage and recovery checks

**Goal:** Support death spiral mechanics after a PC drops.

### Candidate features

- Persistent damage tick modeling.
- Recovery checks.
- Initiative timing assumptions.
- Stabilize/healing intervention assumptions.
- Configurable enemy behavior toward downed PCs.

---

## v1.0.0 — Public-quality PF2e release candidate

**Goal:** Package Grim Arithmetic as a robust PF2e Foundry v13 module suitable for broader testing/use.

### Candidate requirements

- Stable install/update workflow.
- Release manifest and downloadable package.
- Changelog.
- User-facing documentation.
- Real PF2e fixture coverage.
- Good error states.
- Exact damage distributions for supported formulas.
- Strike selector.
- Dying/wounded/doomed pressure messaging.
- Encounter-wide immediate risk view or a clearly scoped substitute.

---

## Deferred compatibility work

### Foundry v14

- Re-test scene controls, ApplicationV2 behavior, manifest schema, and PF2e actor/item shapes.
- Add compatibility shim only if v13 and v14 APIs differ.

### Starfinder 2e

- Defer until Foundry v14 support is underway.
- Implement as a separate system adapter rather than blending SF2e logic into the PF2e adapter.

---

## Backlog parking lot

Useful but not yet scheduled:

- Configurable risk label thresholds.
- Combat tracker button.
- Token context menu entry.
- Hotkey support.
- Export/share risk snapshot to GM notes.
- “What changed?” comparison between two assumption sets.
- Player-facing limited mode.
- Foundry package release automation.
- GitHub Actions CI.
- Visual polish / theme compatibility.
