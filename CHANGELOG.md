# Changelog

All notable changes to Grim Arithmetic are documented here.

## v0.6.0-rc.2 - Tighter default round cap and pessimism banner (prerelease)

Followup to rc.1 after the first Foundry-server smoke test surfaced a model-interpretation issue: a "Low Threat" PF2e encounter (per the XP budget) returned a 99% TPK forecast because the v0.6.0 conservative baseline lets two enemies grind a stationary party for 10 rounds. The math was correct; the cap and the UI did not communicate the "upper bound only" framing strongly enough.

- **Lower `DEFAULT_MAX_ROUNDS` from 10 to 5.** Real PF2e encounters typically resolve in 4–6 rounds because the party ends them. Capping the no-action simulation at 5 rounds keeps the metric in the "could plausibly happen before PCs would have acted" range, instead of letting damage pile up across rounds the encounter wouldn't have lasted in real play. Halves the dogpile effect across the board.
- **Pessimism banner.** When any-PC-down probability is >=80%, the Forecast window renders a banner above the result tables: *"Upper bound only — PCs take no actions in this model. Real outcomes are typically much lower because the party fights back, heals, uses reactions, and ends fights before they grind."* Keeps the numbers honest but stops a GM from reading them as prophecy.
- Regenerated all KHT-76 simulation fixtures against the new 5-round default. The fixture math is the regression net; the new snapshots are the new baseline.
- ARITHMETIC.md and MONTE-CARLO-QUESTIONS.md text already framed this correctly; no doc changes required.

## v0.6.0-rc.1 - Monte Carlo encounter simulation (prerelease)

First release candidate. Awaiting personal Foundry-server smoke test before promotion to v0.6.0. Per the v0.5.0 playbook this is published as a **GitHub Pre-release** and is **not** submitted to the Foundry package registry.

- New **Forecast window** (~800w singleton) opened from a "Forecast encounter" button in the Encounter Danger Board header. Mirrors the existing Danger Board → Pair Detail two-window pattern; the v0.5.0 immediate-down view is unchanged.
- New pure-TypeScript Monte Carlo simulation engine with seeded determinism:
  - `mulberry32` PRNG + `xmur3` hash for string seeds; `deriveChildSeed()` produces stable per-iteration sub-seeds.
  - Per-Strike sampler reuses `degreeOfSuccess()`, `damageDistribution()`, `doubleDistribution()`, and `applyDamageAdjustment()` from the existing engine; no math is duplicated.
  - Combatant state transitions (HP, dying, wounded, doomed, downed, dead) mirror the v0.3.0 dying severity rules from `ARITHMETIC.md`.
  - Seeded initiative roll with PCs-win-ties tiebreaker (configurable).
  - Five tactics profiles: **random-legal**, **spread-damage**, **focus-fire**, **predator**, **boss-cinematic**.
  - Round orchestrator (`runIteration`) and iteration runner (`runSimulation`) aggregate any-PC-down, TPK, mean/median rounds-to-first-down, per-PC down/death/HP, per-enemy damage share and top target.
- **Web Worker** integration keeps the Foundry UI responsive during 1k / 5k / 10k iteration runs. Synchronous fallback when `Worker` is unavailable (Vitest / headless). Throttled progress events (≤10/sec) with a guaranteed final flush.
- Per-client setting **Enable Monte Carlo encounter simulation** (defaults on) hides the Forecast button and short-circuits the worker on machines where the feature is too costly.
- Engine guardrails: `MAX_ITERATIONS = 10000`, optional wall-clock budget, cooperative abort that returns a partial result with `aborted: true`.
- **Always-visible assumptions block** in the Forecast window restates every run: "PCs take no actions in this model," "No healing or reactions," "No recovery checks," plus the active tactics profile description.
- Foundry / PF2e bridge: `buildEncounterSetup()` consumes the existing `getEncounterParticipants()` flow into the SimulationCombatant shape; PF2e adapter now reads perception as the initiative bonus.
- Vitest snapshot fixtures (13 snapshots) lock the SimulationResult across all five profiles for 4v1, 4v4, 1v1, and degenerate scenarios so future drift in any engine layer fails loudly.
- `docs/ARITHMETIC.md` documents the Monte Carlo pipeline, tactics profiles, iterations vs standard-error guidance, seeding rules, and the deliberately-not-modeled scope (PC actions, recovery checks, persistent damage, spells, terrain).
- Build: Vite emits the worker as a separate chunk (`dist/assets/simulation.worker-*.js`); the release script already includes it via recursive `dist/` rsync.

Known scope limitations (deferred to later milestones):
- PCs take a no-op turn — no actions, no healing, no reactions, no Hero Point spends.
- No recovery checks between turns.
- No persistent damage.
- No spells / save-based threats.
- No quick-scenario presets, A/B compare, quantile/distribution view (Tier 2–4 UI per the UX plan; v0.6.1–v0.7.0+).

## v0.5.0 - Encounter danger board (main) + Pair detail (popup)

- **UI split**: the Token Controls skull button now opens an **Encounter Danger Board** as the main window. The single-PC vs single-enemy detail view lives in a separate **Pair Detail** popup (one reusable instance).
- Read PC and hostile NPC tokens from the active combat encounter without requiring individual token selection.
- Compute pairwise immediate down-risk for every supported (PC × hostile × Strike) triple by reusing the existing `immediateDownRisk()` engine.
- Danger board shows "Most endangered PCs" and "Most dangerous enemies" formatted as `PC vs Enemy Attack — XX% Label`. Each row has a **Detail** button that opens the Pair Detail window for that exact pair.
- A top-level "Open detail for selected PC + targeted enemy" button preserves the v0.4.x select-and-target workflow.
- Catch per-pair errors so one bad Strike does not poison the whole encounter board.
- Add a `MAX_PAIRS = 200` performance guardrail that short-circuits to a skipped board with a clear caveat instead of freezing Foundry on very large scenes.
- Graceful errors if a referenced token is no longer on the canvas (combat ended or scene changed).
- Remove the previous combined `MortalityPanel` and its template.
- Update `docs/ARITHMETIC.md`, `docs/TESTING.md`, and `BACKLOG.md` to match the split UX.

## v0.4.2 - Foundry v14.361 compatibility metadata

- Mark the module manifest as verified against Foundry VTT v14.361 after initial server smoke testing.
- Update README and testing/install docs to describe v13 minimum plus v14.361 verified status.
- No runtime code changes were required for the initial v14.361 smoke test.

## v0.4.1 - PF2e IWR extraction fix

- Read PF2e immunities, weaknesses, and resistances from `system.attributes`, which is where current PF2e character data exposes them.
- Keep legacy top-level IWR fallback for older or fixture-like data shapes.
- Include IWR fields in sanitized debug capture when present.

## v0.4.0 - Damage adjustments

- Extract simple PF2e resistances, weaknesses, and immunities from actor data.
- Extract primary Strike damage type when available.
- Apply matching resistance, weakness, and immunity to exact normal/crit damage distributions.
- Show the applied damage adjustment note in the panel.
- Keep ambiguous/unknown damage types conservative: no adjustment is silently applied.

## v0.3.1 - Release packaging alpha

- Add MIT license for public/open-source distribution.
- Add Foundry manifest URL and versioned download URL fields.
- Add release packaging script that builds a direct-install Foundry zip.
- Add release-package metadata tests.
- Update release docs with manifest URL install and GitHub Release workflow.

## v0.3.0 - Dying pressure modeling

- Add wounded/doomed dying-severity output.
- Add doomed-adjusted death threshold flagging.
- Add Hero Point prevention assumption messaging.
- Keep permanent death probability explicitly out of scope.

## v0.2.0 - Exact dice distribution engine

- Replace average-only down-risk with exact damage probability mass functions for supported formulas.
- Add damage range, average damage, and swinginess output.
- Use exact cumulative distributions across modeled Strike sequences.

## v0.1.1 - Table-test hardening

- Add module version display, refresh/recalculate, enemy Strike selector, clearer errors, fixture hardening, and sanitized debug capture.

## v0.1.0 - MVP baseline

- Initial GM-only selected-PC vs targeted-enemy immediate down-risk panel.
