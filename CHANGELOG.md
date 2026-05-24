# Changelog

All notable changes to Grim Arithmetic are documented here.

## v0.7.1-rc3 - Tactics profile definitions

Release candidate adding inline definitions for the Encounter Forecast's tactics profiles, plus label polish.

### Tactics profile definitions (KHT-111)
- The **Encounter Forecast** window now shows a bulleted list defining each tactics profile (Random Legal, Spread Damage, Focus Fire, Predator, Boss Cinematic) directly above the **Tactics Profile** dropdown. Definitions are driven by the engine's existing `TACTICS_PROFILE_DESCRIPTIONS`, so they stay in sync with simulation behavior.
- Capitalized the second word of each multi-word tactics label and the word "Profile" in the control heading.
- Bumped verified Foundry compatibility to **v14.363**.

## v0.7.1-rc2 - Hover descriptions

Release candidate adding on-hover descriptions across all three GM windows so the dense PF2e mortality metrics explain themselves.

### Hover descriptions (KHT-108)
- Every labeled metric, control, and table header in the **Encounter Forecast**, **Encounter Danger Board**, and **Pair Detail** windows now carries a `data-tooltip` describing what it means — e.g. "Any PC down", "TPK risk", "Recovery checks per run", "Hero Point saves", "MAP", "Damage swing", "Dying if downed".
- Uses Foundry v13+'s native `data-tooltip` tooltip system, so no extra JavaScript or CSS is required and the panel context builders are unchanged.

### Manifest cleanup
- Removed the unknown `system` and `templates` keys from `module.json` that triggered a Foundry package warning. The `pf2e` system requirement is already declared via `relationships.systems`, and templates are loaded at runtime through each panel's ApplicationV2 `static PARTS`.

## v0.7.0 - ApplicationV2 migration + readability tweaks

v0.7.0 migrates Grim Arithmetic's three windows off the deprecated V1 `Application` framework so Foundry v13+ no longer logs a console deprecation warning, plus a small set of UX fixes against the V2 dark window theme.

### UI tweaks
- Pair Detail and Encounter Forecast windows are bounded (640 / 720) and resizable, with `.window-content` set to `overflow-y: auto` so long content scrolls inside the window instead of being clipped below the viewport.
- In-content headers simplified: Pair Detail shows `Pair Detail`, Encounter Forecast shows `Encounter Forecast` (the full `Grim Arithmetic — <panel>` label stays in the window chrome title bar).
- Pair Detail labels (form `<label>`, summary `<dt>`) inherit the V2 window's primary text color instead of the hard-coded dark brown that read as muddy orange on the dark window background.
- Encounter Danger Board: `Encounter Forecast` button moved before `Detail Selection + Target`, both buttons re-cased to title-case.

### Foundry framework migration (KHT-106)
- **Encounter Danger Board**, **Pair Detail**, and **Encounter Forecast** now extend `foundry.applications.api.HandlebarsApplicationMixin(ApplicationV2)`.
- V1 `defaultOptions` getter → V2 `static DEFAULT_OPTIONS` (window/position/classes/actions sub-objects).
- V1 `getData()` → V2 `_prepareContext()`. Return shapes (`DangerBoardPanelData`, `MortalityPanelData`, `ForecastPanelData`) are unchanged, so all 322 unit tests pass without modification.
- V1 `activateListeners(html)` jQuery bindings replaced by:
  - V2 declarative `static actions` map for all buttons (`data-action="openDetailPair"`, `"openDetailSelection"`, `"openForecast"`, `"refresh"`, `"run"`, `"cancel"`).
  - Native `addEventListener('change', …)` inside `_onRender` for the `<select>` controls in Pair Detail (six selects) and Forecast (tactics profile), since the V2 actions map is click-only.
- Forecast: V1 `close()` override replaced by V2 `_preClose()` so the in-flight Monte Carlo worker handle is still cancelled when the window is dismissed mid-run.
- Static `instance` singletons preserved for `PairDetailPanel` and `ForecastPanel`; cross-panel openers (`openForPair`, `openForSelection`, `open`) keep the same signatures so `src/main.ts` API and the toolbar entrypoint in `src/ui/token-controls.ts` did not need changes.
- Templates updated: button `data-grim-*` attributes swapped to `data-action="…"`; `<select>` `data-grim-control` / `data-grim-forecast-control` attributes preserved.

## v0.6.1 - Forecast panel safety-net visibility (bugfix)

Bugfix release surfacing the Phase I-A safety-net stats that v0.6.0 was already computing but never displaying, plus a more robust PF2e Heal-spell extractor for real-world prepared-caster actors.

### Forecast panel
- Added a "Heals per run / Recovery checks per run / Hero Point saves" row under the headline metrics so GMs can see whether PC healing, recovery checks, and Hero Point death prevention actually fired during the simulation (KHT-105).

### PF2e adapter — heal-capability extraction
- Prepared casters: `extractHealCapability` now walks `spellcastingEntry.system.slots.slotN.prepared` (the canonical PF2e v6+ shape) and counts un-expended preparations whose `id` references a Heal spell item, instead of only reading a `slotsRemaining` field that real PF2e prepared casters do not populate. This is the root-cause fix for "Mira's heals never fire."
- Spontaneous casters: when an entry's `prepared.value === 'spontaneous'` and Heal is in its spell list, the entry's per-rank `value` (remaining slots) is counted as Heal-castable.
- Item access now prefers `actor.itemTypes.<type>` (PF2e's pre-filtered arrays) over walking `actor.items`, with the latter as a fallback. Removes one class of "items collection looked empty" failure modes.
- Legacy item-level `slotsRemaining` fallback retained for completeness so existing synthetic fixtures still pass.

### Debug logging
- When the **Debug logging** module setting is enabled, the encounter setup builder logs each PC's extracted healing capability (Battle Medicine, Heal cantrip, Heal spell slots, Medicine modifier, Medicine DC).
- The PF2e adapter additionally emits a verbose `extraction probe` log per PC dumping item-type counts, every Heal spell found, and the raw slot/prepared structure for each spellcasting entry — so future shape mismatches between Grim Arithmetic and the PF2e system can be diagnosed from a console paste without source access.

### Cleanup
- Removed two dead identifiers (`ITERATION_CHOICES`, an unused `totalIterations` parameter) that were tripping `npm run lint`.

### Known issues (deferred to v0.7.0)
- Foundry v13+ logs a console deprecation warning for the V1 Application framework. The warning is non-fatal until Foundry v16; the three panels (Encounter Danger Board, Pair Detail, Forecast) will be migrated to `ApplicationV2` in v0.7.0 (KHT-106).
- A `"message channel closed before a response was received"` console error reported in some sessions traces to a browser extension's `chrome.runtime.onMessage` listener, not Grim Arithmetic. The module uses zero Chrome extension APIs (KHT-107 — closed as external).

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
