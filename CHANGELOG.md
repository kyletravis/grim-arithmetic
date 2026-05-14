# Changelog

All notable changes to Grim Arithmetic are documented here.

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
