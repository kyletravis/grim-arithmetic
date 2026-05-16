# Changelog

All notable changes to Grim Arithmetic are documented here.

## v0.6.0-rc.6 - Simplified forecast controls (prerelease)

Streamlined the Forecast panel UI: removed iteration count selector (fixed at 5,000), removed seed input, set default tactics profile to **Spread damage**, and surfaced the tactics profile name + description directly above the headline metrics.

- **Default tactics profile** changed from `focus-fire` to `spread-damage`. The description and name now render as a persistent line above the headline metrics (Any PC down / TPK risk / Expected first down) so the active assumption is always visible.
- **Removed iteration dropdown.** All runs use 5,000 iterations. The 1,000 / 10,000 options were rarely used and added cognitive overhead.
- **Removed seed input.** Seed remains random per run; the CI note explains that numbers are from sampling variance.
- **Run forecast button text** shortened to "Forecast" and compacted (smaller padding, smaller font, reduced min-height).
- **Assumptions block** no longer repeats the tactics profile name/description or iteration count — those are now shown above the metrics where they belong.
- **CSS:** `.grim-arithmetic-forecast__profile` style added for the tactics profile line; button compacted; control grid reduced from 4-column to 2-column.

## v0.6.0-rc.5 - Monte Carlo confidence intervals (prerelease)

Hybrid Monte Carlo + exact-confidence-interval approach for encounter forecasting. Every proportion metric (down %, death %, TPK %) now displays a 95% confidence interval in brackets, computed from the sampling variance of the simulation. Continuous metrics (mean first-down round) also get CIs.

- **`SimulationConfidenceIntervals`** type added to `simulation-types.ts`: `anyPcDown`, `tpk`, and `meanFirstDownRound` intervals.
- **`buildConfidenceIntervals()`** in `run-simulation.ts`: uses normal approximation (`z = 1.96`) for proportions (`p ± 1.96 * sqrt(p*(1-p)/n)`) and means (`mean ± 1.96 * sampleStd / sqrt(n)`). Clamps proportions to [0, 1].
- **`panel-data.ts`**: `ForecastResultView` and `ForecastPcRow` gain `downCi`, `deathCi`, `anyPcDownCi`, `tpkCi`, and `meanFirstDownCi` string fields. `proportionCI()` helper added.
- **`forecast-panel.hbs`**: headline metrics and per-PC table rows render CI brackets inline; a "95% confidence intervals from sampling variance" note appears below run metadata.
- **CSS**: `.grim-arithmetic-forecast__ci` (muted inline brackets) and `.grim-arithmetic-forecast__ci-note` (italic explanation).
- No changes to simulation engine, tactics, or core metrics — purely additive uncertainty communication.

## v0.6.0-rc.4 - Phase I-A: PC heals + recovery + Hero Point survival (prerelease)

Followup to rc.3. The rc.3 build had PCs trading Strikes with enemies but no safety net — no healing, no recovery checks, no Hero Point survival. Real-table parties have all three, so rc.3 still overstated risk. rc.4 ships **Phase I-A** of the v0.6.0 PC action work: every PC survival mechanic except reactions (Shield Block, Champion — reserved for rc.5 Phase I-B).

- **PF2e adapter** now extracts each PC's Medicine modifier, Battle Medicine feat, prepared Heal spell slots (per rank), and Heal cantrip caster level. Surface via a new optional `pcCapabilities` sub-object on `CombatantSnapshot`.
- **Recovery checks**: dying PCs roll DC 10+dying at the start of their turn. PF2e degree-of-success applies: crit-success / success / failure / crit-failure step dying by −2 / −1 / 0 / +1. Most dying PCs recover within 1–2 rounds; cuts TPK rates significantly.
- **Healing actions**: full PF2e Battle Medicine (Medicine check vs DC, proficiency-scaled heal, crit-fail collateral) + Heal spell 1/2/3-action variants + Heal cantrip with heightened scaling. Heal spell on a dying target clears dying per PF2e.
- **Hero Point death prevention**: when a PC would die, they spend a Hero Point to drop to dying 0 at 0 HP. Capped at one HP survival per iteration per PC.
- **PC tactics** now substitutes Strikes for heal actions when an ally is dying (emergency, full-turn heal) or below 40% HP (top-up, 1-action heal + 1 Strike). Healer-preference order: Heal spell 2-action > Heal cantrip 2-action > 1-action variants > Battle Medicine. Spell slots decrement; Battle Medicine 1/target/day enforced.
- **Forecast assumption block** rewritten for the new model. Pessimism banner copy acknowledges PCs are now fully active.
- **SimulationResult.safetyNet** aggregate: `meanHealsPerIteration`, `meanRecoveryChecksPerIteration`, `heroPointSurvivalRate` — surface in the UI so GMs can see the safety net firing.
- Fixture snapshots regenerated against the new model.

Still deferred to **rc.5 Phase I-B**: Shield Block reaction, Champion reactions (Liberator/Redeemer/Paladin variants). After rc.5 the "not modeled" list shrinks to spells beyond Heal, persistent damage, attacks of opportunity, movement/reach/LoS, and initiative-altering abilities.

## v0.6.0-rc.3 - PC action modeling (prerelease)

Followup to rc.2 after the user's first real-encounter Foundry test concluded that the "PCs take no actions" baseline produced output that was directionally honest but operationally useless: a PF2e "Low Threat" encounter returned a 99% TPK because two enemies grind a stationary party. Real GMs don't think in "what if my party were stones." rc.3 pulls PC action modeling forward from v0.7.0+ into v0.6.0 so the Forecast is GM-useful before v0.6.0 promotes.

- **PCs now act in the simulation.** Each PC takes 2 Strikes per turn against the most-dangerous standing enemy (selected by enemy mean damage output, ties broken by lower HP then lower id). Same MAP escalation as enemy strikes; agile traits reduce MAP from -5/-10 to -4/-8.
- **PF2e adapter extracts PC Strikes** from `actor.system.actions` (PF2e's compiled strike list with totalModifier baked in). Falls back to walking equipped weapons in `actor.items` when actions is empty or unusable. PCs with no extractable Strike caveat in the assumptions block and skip their turns in the simulation rather than crashing.
- **One hardcoded PC tactics profile in rc.3.** No UI dropdown. Future v0.6.1 may add tactics variants ("PCs play smart / dumb / kill the caster / etc.") if GMs want them.
- **Forecast UI copy updated.** Assumption block no longer says "PCs take no actions"; the pessimism banner (still triggers at any-PC-down ≥ 80%) now frames extreme results as genuine structural lethality rather than a stones-of-the-PCs artifact.
- **Encounter setup builder** populates PC attacks the same way it has populated enemy attacks since rc.1.
- **Fixture snapshots regenerated.** All 13 KHT-76 snapshots changed because PCs now deal damage. New "PCs act" sanity assertion fails clearly if the orchestrator ever stops routing PC turns to the PC profile.
- **ARITHMETIC.md updated** with the rc.3 PC model; the "explicitly not modeled" list shrinks (PC actions removed; healing, reactions, recovery checks, persistent damage, and spells remain deferred).

Concrete impact on the rc.2-failing encounter (3 PCs vs Ghoul Stalker + Giant Rat): the 99% TPK forecast should drop dramatically. Most PCs will survive; the focused PC (Bob at 13 HP) still has elevated risk, which is correct.

Still deferred to v0.7.0+ / v0.8.0+ (called out in the assumptions block):
- Healing (Battle Medicine, Heal spell)
- Reactions (Shield Block, Champion reactions, AoO)
- Recovery checks between turns
- Persistent damage
- Spell damage / save-based actions
- Multi-tier PC tactics in the UI (v0.6.1)

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
