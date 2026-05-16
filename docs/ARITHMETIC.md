# Grim Arithmetic Calculation Guide

> **Purpose:** Explain, in plain English and implementation-level detail, what goes into Grim Arithmetic's risk calculation.  
> **Current baseline:** v0.5.0 encounter-wide immediate risk view
> **Audience:** GMs, testers, contributors, and anyone asking “where did that percentage come from?”

Grim Arithmetic is a decision-support tool, not a combat oracle. Its current MVP answers one narrow question:

> **If the targeted enemy spends its next modeled turn making Strikes against the selected PC, what is the chance the PC is reduced to 0 HP or below?**

The headline output is therefore **immediate down-risk**, not full death probability and not encounter outcome probability.

---

## Current MVP summary

The current calculation uses:

- selected PC's current HP
- selected PC's temporary HP, if available
- selected PC's AC
- optional manual AC adjustment, such as Raise Shield
- targeted enemy's Strike attack bonus
- targeted enemy's Strike damage formula
- selected number of enemy Strikes: 1, 2, or 3
- Multiple Attack Penalty model: normal, agile, or none
- PF2e degree-of-success rules for d20 attacks
- exact probability mass functions from supported dice formulas
- simple doubled total damage distribution on critical hits
- cumulative exact damage distribution across the modeled Strike sequence
- wounded and doomed values for dying severity if the PC is downed
- optional Hero Point death-prevention assumption messaging
- simple resistance, weakness, and immunity adjustments when Strike damage type is confidently known

The current calculation does **not** model:

- permanent death probability
- recovery checks
- healing before or during the enemy turn
- Hero Point survival probability
- Shield Block damage prevention
- Champion reactions or other defensive reactions
- resistance, weakness, or immunity edge cases for ambiguous/mixed damage
- deadly, fatal, precision, splash, or persistent damage
- enemy tactics beyond “make this many Strikes against this PC”
- terrain, reach, movement, action availability, or line of effect

Some of these are planned backlog items. When they are implemented, this document should be updated in the same PR/commit.

---

## Input flow

In Foundry, the MVP expects this workflow:

1. The GM selects exactly one PC token.
2. The GM targets exactly one enemy token.
3. The GM opens Grim Arithmetic from the skull button in Token Controls.
4. Grim Arithmetic extracts data from the selected and targeted tokens.
5. The panel calculates immediate down-risk.

Internally, the calculation is split into layers:

- **Foundry selection layer** — figures out selected PC and targeted enemy.
- **PF2e adapter layer** — extracts HP, AC, Strike bonus, damage, and MAP hints from Foundry/PF2e actor data.
- **Engine layer** — performs pure probability/math calculations without Foundry dependencies.
- **UI layer** — formats the result as percentages, labels, assumptions, and caveats.

---

## Combatant data used

### Selected PC

The MVP uses:

- **Current HP**
- **Temporary HP**, if available
- **AC**
- **Wounded value**, used to report dying severity if downed
- **Doomed value**, used to report the adjusted death threshold
- **Hero Points**, used only for the Hero Point availability note

The modeled HP is:

```text
modeled HP = current HP + temporary HP
```

If the GM applies a shield/AC adjustment in the panel, the effective AC is:

```text
effective AC = actor AC + selected AC adjustment
```

For example:

```text
Actor AC: 21
Shield adjustment: +2
Effective AC used by Grim Arithmetic: 23
```

### Targeted enemy

The module lets the GM choose among the enemy's supported melee Strikes. For the selected Strike, it extracts:

- Strike name
- attack bonus
- damage formula
- primary damage type, when available
- MAP type if detectable:
  - `normal`
  - `agile`
  - `unknown`, which defaults to normal MAP in Auto mode

If the previously selected Strike is no longer available, the panel falls back to the first supported Strike.

---

## Attack outcome math

For each modeled Strike, Grim Arithmetic evaluates all 20 possible d20 rolls.

For each die result from 1 through 20:

```text
attack total = d20 result + attack bonus + MAP penalty
```

That total is compared to the PC's effective AC using PF2e degree-of-success rules.

### Base degree of success

```text
if attack total >= AC + 10: critical success
else if attack total >= AC: success
else if attack total <= AC - 10: critical failure
else: failure
```

### Natural 20 and natural 1

PF2e upgrades or downgrades the degree of success:

```text
natural 20: improve the result by one step
natural 1: worsen the result by one step
```

The possible degrees, from worst to best, are:

```text
critical failure → failure → success → critical success
```

So a natural 20 that would otherwise be a failure becomes a success. A natural 1 that would otherwise be a success becomes a failure.

### Probability output

After checking all 20 die results, Grim Arithmetic counts how many rolls produce each outcome:

```text
critical success probability = critical success count / 20
success probability          = success count / 20
failure probability          = failure count / 20
critical failure probability = critical failure count / 20
```

Because this is a d20, each individual die result is worth 5 percentage points.

---

## Multiple Attack Penalty

The GM chooses, or Auto-detects, a MAP model.

### Normal MAP

```text
Strike 1:  0
Strike 2: -5
Strike 3: -10
```

### Agile MAP

```text
Strike 1:  0
Strike 2: -4
Strike 3: -8
```

### No MAP

```text
Strike 1: 0
Strike 2: 0
Strike 3: 0
```

No MAP is mainly a what-if/debug option. It can also approximate special cases where the GM wants to ignore MAP, but the MVP does not yet validate whether that is rules-legal.

---

## Damage math in v0.2.0

The current calculation uses **exact dice distributions** for supported formulas. Instead of replacing `1d8+4` with only its average, Grim Arithmetic builds a probability mass function: every possible damage total and the probability of rolling it.

Supported formulas are simple additive/subtractive dice expressions, such as:

```text
1d8
2d6+4
2d8 + 6
1d12+1d6+3
4
```

Unsupported formulas include typed/tagged or conditional PF2e expressions such as:

```text
2d8[persistent,fire]+4
1d8+1d6 precision
1d10 plus Grab
```

### Probability mass functions

A probability mass function, or PMF, records each total and its probability.

For `1d4`, the PMF is:

```text
1: 25%
2: 25%
3: 25%
4: 25%
```

For `2d6+4`, Grim Arithmetic convolves the two d6 rolls, then adds the flat modifier. The minimum is 6, the maximum is 16, and the average is 11. A total of 11 is the most likely result because it comes from rolling 7 on 2d6.

### Formula summary

For every supported formula, the engine produces:

```text
minimum damage
maximum damage
mean / average damage
probability of each total
```

The mean is still displayed because it is useful for intuition and expected HP, but down chance is no longer based on mean-only thresholds.

### Critical damage in v0.2.0

Critical damage is modeled as simple doubled total damage:

```text
crit total = normal total × 2
```

For example, `1d4+2` has normal totals 3, 4, 5, and 6. Its simple crit distribution is 6, 8, 10, and 12.

This is still intentionally simplified. PF2e traits like deadly and fatal are not modeled yet.

---

## Expected damage

For each Strike, Grim Arithmetic computes expected damage from the mean of the exact distribution:

```text
expected damage from Strike =
  success probability × normal damage mean
+ critical success probability × critical damage mean
```

Failures and critical failures contribute zero damage in the current Strike model.

For multiple Strikes, expected damage is the sum of each Strike's expected damage after applying MAP:

```text
total expected damage = Strike 1 expected damage + Strike 2 expected damage + Strike 3 expected damage
```

The displayed expected HP after the modeled turn is:

```text
expected HP after turn = max(0, modeled HP - total expected damage)
```

Important: expected HP is a mean-based summary. It is not the same thing as down probability. The down chance uses the full exact damage distribution.

---

## Down probability

The down probability answers:

```text
What fraction of modeled attack + damage sequences deal damage >= modeled HP?
```

For each Strike, Grim Arithmetic now has three branch groups:

```text
miss branch: 0 damage
hit branches: every normal damage total from the exact PMF
crit branches: every doubled damage total from the exact crit PMF
```

The probability of the miss branch is:

```text
failure probability + critical failure probability
```

Each hit branch probability is:

```text
success probability × probability of that normal damage total
```

Each crit branch probability is:

```text
critical success probability × probability of that doubled crit damage total
```

For one Strike, the down probability is the sum of hit/crit branches where damage is at least the PC's modeled HP.

For multiple Strikes, Grim Arithmetic convolves cumulative damage states across the selected Strike sequence.

Example for two Strikes:

```text
Strike 1 miss + Strike 2 miss
Strike 1 miss + Strike 2 each hit/crit damage total
Strike 1 each hit/crit damage total + Strike 2 miss
Strike 1 each hit/crit damage total + Strike 2 each hit/crit damage total
```

Each path has a probability:

```text
path probability = Strike 1 branch probability × Strike 2 branch probability
```

The module adds together the probabilities of all paths where:

```text
cumulative damage >= modeled HP
```

That final sum is the displayed **down chance**.

---

## Why down chance and expected HP can feel different

Expected HP and down chance are related but not interchangeable.

Example:

```text
Modeled HP: 20
Expected damage: 10
Expected HP after turn: 10
```

This does not mean down chance is zero. If the enemy has a meaningful crit branch that deals 20+ damage, the PC may still have a non-zero chance of dropping.

Likewise:

```text
Modeled HP: 8
Expected damage: 9
Expected HP after turn: 0
```

This does not necessarily mean the PC is guaranteed to drop. It means the average damage exceeds HP, but individual miss/hit/crit branches still determine the actual down probability.

This is why v0.2.0 uses exact dice distributions for down chance: average damage is useful, but it can hide swinginess.

---

## Risk labels

The MVP maps down probability to labels:

```text
0% to <5%    = Low
5% to <15%   = Guarded
15% to <35%  = Dangerous
35% to <60%  = Severe
60%+         = Grim
```

These labels are meant as quick GM-facing signals, not official PF2e difficulty categories.

---

## Worked example

Suppose:

```text
PC modeled HP: 7
PC effective AC: 20
Enemy attack bonus: +10
Enemy damage: 1d4+2
Enemy turn model: 1 Strike
MAP: normal
```

### Step 1: damage distribution

`1d4+2` has normal damage totals:

```text
3: 25%
4: 25%
5: 25%
6: 25%
```

The simple crit distribution doubles the total:

```text
6: 25%
8: 25%
10: 25%
12: 25%
```

### Step 2: Strike probabilities

For attack bonus +10 against AC 20, the engine evaluates all d20 rolls and applies PF2e natural 20/natural 1 rules. The result is:

```text
hit chance: 50%
crit chance: 5%
miss/critical failure chance: 45%
```

### Step 3: exact down check

The PC has 7 modeled HP.

Normal hits cannot down the PC because the maximum normal damage is 6.

A crit does not always down the PC either:

```text
crit 6: does not down
crit 8: downs
crit 10: downs
crit 12: downs
```

So only 75% of crit damage rolls down the PC.

```text
down chance = crit chance × crit-roll down fraction
            = 5% × 75%
            = 3.75%
```

A mean-only model would have treated the average crit as 9 and reported the full 5% crit chance. The exact distribution avoids that false precision.

---

## Dying severity and immediate death flags

v0.3.0 still treats **down chance** as the probability that modeled damage reduces the selected PC to 0 HP or below. It now also reports what that down would mean for PF2e dying pressure.

When a downing hit occurs, Grim Arithmetic reports two severity numbers:

```text
normal hit down: Dying 1 + wounded
critical hit down: Dying 2 + wounded
```

Doomed lowers the dying value at which the PC dies:

```text
death threshold = max(1, 4 - doomed)
```

Examples:

```text
Wounded 0, Doomed 0:
normal down -> Dying 1
crit down   -> Dying 2
death threshold -> Dying 4

Wounded 1, Doomed 1:
normal down -> Dying 2
crit down   -> Dying 3
death threshold -> Dying 3
```

The panel's **Immediate death flag** is threshold-oriented, not a probability:

- If normal-down severity reaches the doomed-adjusted threshold, the flag says so.
- Otherwise, if crit-down severity reaches the threshold, the flag says so.
- Otherwise, if crit-down severity is one step below the threshold, the flag calls that out.
- Otherwise, it reports the normal/crit dying values for table awareness.

This is deliberately **not** permanent death probability. It does not model recovery checks, initiative order, healing, follow-up attacks after the PC is down, Hero Point decisions, table-specific death-prevention rules, or enemy behavior after a target falls.

### Wounded override

The Wounded control now affects dying severity output. It does not change the down chance, because wounded does not change whether damage reduces HP to 0.

Use this when the actor's wounded condition is missing, stale, or you want to test table hypotheticals such as “what if this PC were already Wounded 2?”

### Hero Point assumption

The Hero Point control has three modes:

- **Use actor Hero Points** — assume death prevention is available if the adapter sees one or more Hero Points.
- **Assume Hero Point available** — force the Hero Point note to available.
- **Assume no Hero Point** — force the Hero Point note to unavailable.

This only changes the explanatory note. Grim Arithmetic does not convert Hero Point use into a survival probability.

---

## Damage adjustments in v0.4.0

When PF2e actor data exposes the selected PC's resistances, weaknesses, or immunities and the selected enemy Strike exposes a primary damage type, Grim Arithmetic applies a simple PF2e-style adjustment to each exact damage outcome:

```text
adjusted damage = max(0, rolled damage - matching resistance) + matching weakness
```

If the PC is immune to the Strike's damage type, modeled damage is set to 0.

The adjustment is applied separately to the normal-hit and crit-hit exact distributions. This means down chance, damage range, average damage, and expected HP all use the adjusted distribution.

Matching is intentionally conservative:

- exact damage-type matches apply, such as `fire` resistance against `fire` damage
- `physical` applies to `bludgeoning`, `piercing`, and `slashing`
- `all` applies to any known damage type
- unknown or ambiguous damage types do **not** silently apply adjustments

The panel reports the applied adjustment note, for example:

```text
Applied slashing resistance 5 and slashing weakness 2.
Damage type unknown; no resistance, weakness, or immunity applied.
```

Current limitations:

- mixed damage types are not split into separate pools yet
- exceptions and bypass rules are not modeled
- precision, splash, persistent, deadly, and fatal remain deferred
- manual damage-type/value override controls are still planned

---

## Current interpretation guidance

Use the MVP result as:

- “How risky is this enemy's immediate Strike sequence?”
- “Is this danger mostly crit-driven?”
- “How much does +1 or +2 AC change the risk?”
- “Would 1 Strike be safe, but 2 or 3 Strikes become scary?”

Do **not** use the MVP result as:

- “This PC has exactly X% chance to die.”
- “This encounter has X% chance of a TPK.”
- “This enemy will definitely make all these Strikes.”
- “This accounts for every PF2e defensive rule.”

---

## Encounter-wide danger board in v0.5.0

v0.5.0 splits the UI into **two windows**: an Encounter Danger Board (main, opened by the skull button) and a Pair Detail popup (one reusable instance, opened from danger board rows or from the "selected PC + targeted enemy" button). The single-pair math is unchanged — the encounter view simply runs that same engine against every supported pair in the active combat, and the detail window renders one pair at a time using the same `buildMortalityPanelData` builder.

### How pairs are generated

When a combat encounter is active, Grim Arithmetic reads combatants from `game.combat`:

- Tokens whose actor disposition resolves to `pc` go into the **PCs** list.
- Tokens whose token-document disposition resolves to `enemy` (PF2e hostile, Foundry disposition `-1`) go into the **hostiles** list.
- Allied or neutral combatants are excluded with a caveat naming each one.
- Combatants the system adapter cannot extract are surfaced as **unsupported actors** rather than throwing.

For each PC and each supported melee Strike on each hostile, Grim Arithmetic builds an `ImmediateDownRiskInput` from the same panel controls used by the single-pair detail view, calls the existing `immediateDownRisk()` engine, and records the result as a `PairRisk`:

```text
PairRisk = { pcId, pcName, enemyId, enemyName, attackId, attackName, downProbability, riskLabel, caveats[] }
```

If `immediateDownRisk()` throws for one pair (for example, a malformed damage formula), the error is caught and surfaced as a per-pair caveat. Other pairs continue computing.

A hostile with no supported attacks does not contribute pairs; an encounter-level caveat names the hostile.

### Ranking

The danger board ranks two things:

1. **Most endangered PCs** — each PC appears at most once. The shown entry is the PC's worst pair (highest `downProbability`) across every hostile and every Strike. The list is sorted descending and truncated to a top-N (default 5).
2. **Most dangerous enemies** — each hostile appears at most once. The shown entry is the hostile's worst pair (highest `downProbability`) against any PC. Same sort/truncation.

Each entry is formatted as:

```text
PC vs Enemy Attack — XX% Label
```

For example: `Mira vs Troll Claw — 38% Severe`. The percentage is rounded to the nearest whole; the label is the same Low / Guarded / Dangerous / Severe / Grim mapping as the detail view.

### Performance guardrails

To avoid freezing the Foundry UI on very large scenes, the matrix function refuses to compute when the projected pair count (PCs × hostile-attack permutations) exceeds `MAX_PAIRS` (default **200**). When the guardrail trips, the danger board renders as **skipped** with a single caveat instead of partial or unbounded results. The single-pair detail view is unaffected.

### What the danger board does not do

- It does not run a Monte Carlo simulation, model turn order, or simulate tactics.
- It does not account for healing, reactions, or follow-up rounds.
- It does not change any of the single-pair math; the same engine, assumptions, and caveats apply.

These are addressed by the Monte Carlo simulation in v0.6.0; see the next section.

---

## Monte Carlo encounter simulation in v0.6.0

v0.6.0 adds an entirely new feature alongside the v0.5.0 danger board: a Monte Carlo simulation of the active encounter. The danger board's single-pair down-risk math is unchanged. The simulation is **opt-in per run** and lives in its own window.

### What the simulation answers

The danger board answers: *"if the enemies all swung at the PCs right now, who would drop?"* — narrow, per-pair, no turn order, no tactics.

The Monte Carlo simulation answers: *"if we played out this encounter many times under explicit assumptions, what tends to happen?"* — broader, full encounter, configurable tactics. Headline metrics:

- **Any-PC-down probability** — fraction of iterations where at least one PC was downed.
- **TPK probability** — fraction of iterations where every PC was downed.
- **Expected first-down round** — mean / median round in which the first PC dropped.
- **Per-PC down and death rates**, mean ending HP, biggest contributing enemy.
- **Per-enemy damage share** and top target.

### Where the UI lives

Per the v0.6.0 UX plan, the Monte Carlo UI lives in its own singleton **Forecast window** (~800w), distinct from the Danger Board. The Danger Board gets one new header button ("Forecast encounter") that opens the singleton — one click between the two views, intentional. The danger board's "what's lethal right now" identity stays uncluttered, and the forecast has room for per-PC tables, per-enemy tables, and an always-visible assumptions block without compressing the existing endangered/dangerous lists.

### The pipeline

The simulation engine is pure TypeScript (no Foundry imports) and runs on every iteration in a strict order:

```text
seeded RNG  →  initiative roll  →  per-turn tactics plan
            →  per-Strike sampler  →  state transition (damage, dying)
            →  termination check
```

For each Strike the sampler:

1. Draws a d20 face via `rng.nextInt(1, 20)`.
2. Applies the existing PF2e nat-1 / nat-20 step-shift rules through the shared `degreeOfSuccess()` helper.
3. On `success` or `criticalSuccess`, samples a damage total from the exact analytic PMF (the v0.4.0 / v0.5.0 `damageDistribution()` + `doubleDistribution()` path) using inverse-CDF over `rng.next()`.
4. Applies defender resistance / weakness / immunity via the same v0.4.0 helper the panel uses.

The state transition function (`applyDamage`) handles the v0.3.0 dying / wounded / doomed rules: temp HP drains first; PCs entering dying take `1 + wounded` on a normal hit, `2 + wounded` on a critical hit; death threshold is `max(1, 4 - doomed)`. Enemies at 0 HP are marked dead directly (no dying spiral).

### Tactics profiles

Five tactics profiles ship in v0.6.0. Each is a pure function of state plus the seeded RNG, so the same setup + seed + profile always produces identical results.

- **Random legal** — pick any legal PC target and any attack independently per strike. Conservative baseline: if even random play produces a high down rate, the encounter is structurally dangerous, not just dangerous under optimal tactics.
- **Spread damage** — distribute strikes across higher-HP standing PCs; never target downed. Use this when modeling enemies that try to keep all PCs in the fight at once.
- **Focus fire** — concentrate every strike on the lowest-HP standing PC. Use this when modeling enemies that "kill the wounded one." Tends to drive higher per-PC death rates than spread.
- **Predator** — prioritize wounded > low-HP > full-HP standing PCs; attack downed only if no standing PCs remain. Models monsters with "hunt the weak" lore.
- **Boss cinematic** — use the highest-mean-damage attack on the toughest (highest-HP) standing PC, all strikes on the same target. Models the dramatic boss-vs-tank matchup; the MAP-penalized follow-ups hit hard because the chosen attack is high-damage.

A profile that lands on a target dropped by an earlier strike in the same turn still resolves the remaining strikes — the plan is committed when the turn begins. This is intentional and slightly more lethal than a "smart" enemy that would retarget; it is the conservative-for-the-PCs assumption.

### PC tactics (v0.6.0-rc.3)

rc.1 and rc.2 shipped with PCs taking no actions in the simulation. That made the output disorienting against GM intuition — a PF2e "Low Threat" encounter would report a 99% TPK because two enemies grind a stationary party for 5 rounds. rc.3 pulls PC action modeling forward from v0.7.0+ into v0.6.0 so the forecast is GM-useful before v0.6.0 promotes.

In rc.3, PCs use **one hardcoded tactics profile** (no UI dropdown). Future v0.6.1 may add variants:

- **Target selection.** PCs target the standing enemy whose primary attack has the highest mean damage — the actual threat to the party, not the lowest-HP minion. Tiebreakers: lower current HP wins, then lower id ascending (determinism).
- **Strikes per turn.** Two, matching PF2e's standard two-action attack routine. MAP escalates from 0 to -5 (or 0 to -4 for agile weapons), identical to enemy strikes.
- **Attack selection.** PC uses their first available Strike (mirrors `pickFirstAttack` for enemies). A future enhancement could pick by best expected damage against target AC.
- **Skip cases.** PC skips its turn cleanly when no standing enemies remain or when the PC has no extractable Strike. The setup builder surfaces "<name> has no supported Strike; will skip its turns in the simulation." as a caveat.

PC Strikes resolve through the exact same `sampleStrike` + `applyDamage` pipeline as enemy strikes. Enemy resistance/weakness/immunity applies to PC damage symmetrically. An enemy at 0 HP is marked dead directly (no dying spiral); the encounter ends early once all enemies are dead.

### Iterations and stability

Three iteration counts are exposed in the UI:

| Iterations | Approx. headline standard error | Approx. wall-clock on a typical GM machine |
|------------|---------------------------------|---------------------------------------------|
| 1,000      | ±3% on any-PC-down              | Sub-second |
| 5,000      | ±1.4% on any-PC-down            | A few seconds (default) |
| 10,000     | ±1% on any-PC-down              | Several seconds |

Use 1k for quick what-ifs; 5k for the typical case; 10k when comparing two close options (encounter A vs encounter B, or two tactics profiles) where the gap might be within 1k's noise band. The engine refuses to run more than 10,000 iterations in a single call.

### Seeding

Two forms accepted in the seed input:

- Blank: a fresh random seed is picked each run; results vary run-to-run within the standard-error band.
- Filled (string or number): deterministic. Same seed + same setup + same config → byte-identical SimulationResult.

The runner derives a per-iteration sub-seed from the master seed so iteration N is reproducible independently of total iteration count. Truncating from a 5k run to a 1k run yields the same first 1,000 per-iteration outcomes when the master seed matches.

### Explicitly not modeled in v0.6.0

The simulation is intentionally conservative; the assumptions block in the Forecast window restates these every run. PC actions joined the model in rc.3 and are no longer listed here.

- **PC healing.** No Battle Medicine, Heal spells, Treat Wounds. A PC that drops stays dropped for the rest of the iteration. The largest single residual deviation from real play after rc.3.
- **Reactions.** Shield Block, Champion reactions, attack-of-opportunity, and other reactions are not modeled.
- **Recovery checks.** A PC that drops stays dying; subsequent strikes increment dying, but there is no recovery roll between turns. v0.8.0+ is scoped to add it.
- **Persistent damage.** v0.8.0+.
- **Spells and save-based actions.** Both PCs and enemies use Strikes only. v0.7.0+ adds saves and primary spell attacks.
- **Movement, reach, line of sight.** The simulation assumes everyone can reach everyone.
- **Initiative-altering abilities.** Delay, Ready, surprise rounds, and feats that move initiative are not modeled. The runner re-uses the rolled order every round.
- **PC multi-attack action economy beyond 2 Strikes/turn.** Real PCs sometimes Strike 3 times (third Strike at -10 MAP); rc.3 caps at 2. Real PCs also use the third action for movement, Raise Shield, Demoralize, Battle Medicine, etc. — none of those are modeled, so the simulation under-rewards parties that lean on third-action options.

### How to interpret the numbers

The forecast is decision support, not prophecy.

- After rc.3, the simulation reflects realistic round counts (typically 2–4 rounds) because both sides act. Encounters that "should" end fast usually do; encounters that look like grinds will show high TPK or per-PC-death rates worth examining.
- A 30% TPK probability is still a **model artifact**, not a 30% campaign-death chance. It's the probability under "no healing, no reactions, no Hero Points, fixed tactics for both sides." Real-table risk usually skews lower because PCs use Battle Medicine, Shield Block, Demoralize, and similar non-Strike actions the model does not yet simulate.
- A 1k run with TPK 5% and a second 1k run with TPK 8% are within the same noise band (±3%). If a close call matters, bump to 10k.
- Risk pills (Low / Guarded / Dangerous / Severe / Grim) use the same v0.5.0 thresholds; per-PC risk is mapped from each PC's own down probability.
- The biggest threat enemy is "who contributed the most absorbed damage across iterations," not necessarily "who's the dramatic villain."
- The Danger Board's per-pair view is still the right tool for "what's lethal *right now in a single turn*"; the Forecast answers the multi-round encounter question.

### Performance and the kill switch

The simulation runs in a Web Worker so the Foundry main thread stays responsive even at 10k iterations. Progress events are throttled to ~10/sec to avoid postMessage flooding. Aborting a run mid-flight returns a partial result flagged `aborted: true` rather than discarding everything.

A per-client setting in **Configure Settings → Module Settings → Grim Arithmetic** — **Enable Monte Carlo encounter simulation** — disables the feature entirely on machines where it's too costly. When the kill switch is off, the "Forecast encounter" button is hidden on the Danger Board and no Worker is constructed. The v0.5.0 danger board behavior is unchanged either way.

---

## Implementation references

Current calculation code lives in:

```text
src/engine/degree-of-success.ts
src/engine/attack-probability.ts
src/engine/dice.ts
src/engine/mortality.ts
src/engine/encounter-risk.ts
src/engine/prng.ts
src/engine/simulation-types.ts
src/engine/sample-strike.ts
src/engine/sim-state.ts
src/engine/initiative.ts
src/engine/tactics/*.ts
src/engine/run-iteration.ts
src/engine/run-simulation.ts
src/engine/simulation-guardrails.ts
src/engine/simulation.worker.ts
src/engine/run-simulation-in-worker.ts
src/foundry/selection.ts
src/foundry/encounter-participants.ts
src/foundry/encounter-setup.ts
src/ui/panel-data.ts
src/ui/danger-board.ts
src/ui/danger-board-panel.ts
src/ui/pair-detail-panel.ts
src/ui/pair-detail-resolver.ts
src/ui/forecast-panel.ts
src/systems/pf2e-adapter.ts
```

Current tests live in:

```text
tests/degree-of-success.test.ts
tests/attack-probability.test.ts
tests/dice.test.ts
tests/mortality.test.ts
tests/panel-data.test.ts
tests/pf2e-adapter.test.ts
tests/pf2e-adapter-pc-strikes.test.ts
tests/encounter-participants.test.ts
tests/encounter-risk.test.ts
tests/danger-board.test.ts
tests/encounter-guardrail.test.ts
tests/pair-detail-panel.test.ts
tests/prng.test.ts
tests/simulation-types.test.ts
tests/sim-state.test.ts
tests/sample-strike.test.ts
tests/initiative.test.ts
tests/tactics/tactics.test.ts
tests/tactics/pc-default.test.ts
tests/run-iteration.test.ts
tests/run-simulation.test.ts
tests/simulation-guardrails.test.ts
tests/encounter-setup.test.ts
tests/run-simulation-in-worker.test.ts
tests/forecast-panel-data.test.ts
tests/simulation-fixtures.test.ts
tests/settings.test.ts
```
