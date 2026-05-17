# Changelog

All notable changes to Grim Arithmetic are documented here.

## v0.6.0 - Monte Carlo encounter simulation + PC action modeling (prerelease)

v0.6.0 introduces a Monte Carlo encounter simulation engine, a Forecast panel, and Phase I-A PC survival mechanics. The following summarizes the main changes across all rc releases.

### Monte Carlo simulation engine
- New pure-TypeScript Monte Carlo engine with seeded determinism (`mulberry32` PRNG + `xmur3` hash).
- Five tactics profiles: **random-legal**, **spread-damage**, **focus-fire**, **predator**, **boss-cinematic**.
- Round orchestrator aggregates any-PC-down, TPK, mean/median rounds-to-first-down, per-PC down/death/HP, per-enemy damage share and top target.
- Web Worker integration keeps the Foundry UI responsive during 1k–10k iteration runs; synchronous fallback for headless/Vitest.
- Engine guardrails: `MAX_ITERATIONS = 10000`, cooperative abort, and per-client toggle (defaults on).
- Default round cap lowered from 10 to 5 to keep no-action simulation in a plausible range.

### Forecast panel
- New ~800w Forecast window opened from the Encounter Danger Board header.
- Headline metrics (Any PC down, TPK risk, Expected first down) with active tactics profile name + description.
- Per-PC table rows with down %, death %, and mean first-down round.
- 95% confidence intervals on all proportion and continuous metrics, computed from sampling variance.
- Pessimism banner when any-PC-down ≥ 80%, framing results as an upper bound.
- Simplified UI: fixed 5,000 iterations, removed seed input, default tactics changed to **Spread damage**.

### Phase I-A: PC survival mechanics
- PCs now take 2 Strikes per turn against the most-dangerous standing enemy in the simulation.
- PF2e adapter extracts PC Strikes from `actor.system.actions` with equipped-weapon fallback.
- **Healing**: Battle Medicine (Medicine check vs DC, proficiency-scaled heal, crit-fail collateral), Heal spell 1/2/3-action variants, Heal cantrip with heightened scaling. Heal on a dying target clears dying per PF2e.
- **Recovery checks**: dying PCs roll DC 10+dying at the start of their turn; degree-of-success steps dying by −2 / −1 / 0 / +1.
- **Hero Point death prevention**: when a PC would die, they spend a Hero Point to drop to dying 0 at 0 HP (one survival per iteration per PC).
- PC tactics substitutes Strikes for heal actions when an ally is dying (emergency full-turn heal) or below 40% HP (top-up 1-action heal + 1 Strike).
- `SimulationResult.safetyNet` aggregates (`meanHealsPerIteration`, `meanRecoveryChecksPerIteration`, `heroPointSurvivalRate`) surface in the UI.

### Other changes
- Forecast assumption block rewritten to reflect the active PC model.
- Fixture snapshots regenerated across all five tactics profiles (13 snapshots).
- `docs/ARITHMETIC.md` updated with the Monte Carlo pipeline, tactics profiles, seeding rules, and the "not modeled" scope.

Still **not modeled** (deferred to later milestones):
- Shield Block and Champion reactions (Liberator/Redeemer/Paladin)
- Spells beyond Heal / save-based threat modeling
- Persistent damage
- Attacks of opportunity, movement/reach/LoS, initiative-altering abilities
- Permanent-death probability
- Quick-scenario presets, A/B compare, quantile/distribution view

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
