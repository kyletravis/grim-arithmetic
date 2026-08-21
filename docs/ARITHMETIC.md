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

**v0.9.0 change:** deadly and fatal are now modeled (see "Critical hits with deadly / fatal" below) and have been removed from this list; a Heal cantrip line was added because no such spell exists in PF2e.

- permanent death probability
- recovery checks
- healing before or during the enemy turn
- Hero Point survival probability
- Shield Block damage prevention
- Champion reactions or other defensive reactions
- resistance, weakness, or immunity edge cases for ambiguous/mixed damage
- precision, splash, or persistent damage
- enemy tactics beyond “make this many Strikes against this PC”
- terrain, reach, movement, action availability, or line of effect
- Heal cantrip does not exist in PF2e (Stabilize is not modeled)

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

This is still intentionally simplified. Simple doubling is still the model for Strikes without deadly or fatal; see the next section for how those two traits are layered on top.

---

## Critical hits with deadly / fatal (v0.9.0)

**v0.9.0 change:** deadly and fatal are now modeled instead of being ignored. The wording below matches `describeCritModel()`'s output verbatim.

- **Deadly** adds extra weapon-type damage dice **after doubling**: 1 die normally, 2 dice if the weapon rolls 3 dice, 3 dice if it rolls 4 or more. In `describeCritModel()`'s wording: `deadly dN (+M dN after doubling)`.
- **Fatal** first swaps the weapon's damage die for the fatal die, _then_ doubles, then adds one more fatal die on top. In `describeCritModel()`'s wording: `fatal dN (weapon die becomes dN, +1dN after doubling)`.
- A weapon can have both traits; when it does, the fatal swap happens first, then doubling, then the fatal bonus die, then the deadly bonus dice.
- Weapon specialization and property runes are not folded into the crit model; only the base weapon dice, the striking rune, and deadly/fatal are.

### Worked example

`1d8+4` with the `fatal-d10` trait:

1. Fatal swaps the weapon die before doubling: `1d8+4` becomes `1d10+4`. Normal totals run 5–14.
2. Double the swapped formula: 10–28.
3. Add one fatal die (`1d10`, no flat bonus) on top of the doubled total: the final crit range is **11–38**.

If the same weapon also had `deadly-d8`, one more `1d8` would be added after step 3 (two `1d8` if it rolled 3 weapon dice, three if 4+), per the deadly formula above.

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

**v0.9.0 change:** documented that PCs already at 0 HP are excluded from the board (with a caveat), that the board auto-refreshes on combat/actor/token changes, and that it is a single (singleton) window like the Forecast.

v0.5.0 splits the UI into **two windows**: an Encounter Danger Board (main, opened by the skull button) and a Pair Detail popup (one reusable instance, opened from danger board rows or from the "selected PC + targeted enemy" button). Both the Danger Board and Pair Detail are singleton windows — opening either one again re-renders the same instance rather than stacking duplicates. The single-pair math is unchanged — the encounter view simply runs that same engine against every supported pair in the active combat, and the detail window renders one pair at a time using the same `buildMortalityPanelData` builder.

The Danger Board **auto-refreshes** (debounced) whenever combat, actor, or token data changes that could affect the board — combat updates, combatants added/removed, the combat ending, or an actor/token update or deletion — so it stays current without the GM needing to manually reopen it.

### How pairs are generated

When a combat encounter is active, Grim Arithmetic reads combatants from `game.combat`:

- Tokens whose actor disposition resolves to `pc` go into the **PCs** list.
- Tokens whose token-document disposition resolves to `enemy` (PF2e hostile, Foundry disposition `-1`) go into the **hostiles** list.
- A PC already at 0 HP is **excluded from the board** with a per-PC caveat ("`<name>` is already at 0 HP and was excluded from the danger board.") — there is no meaningful "down risk" for a PC who is already down.
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

The danger board answers: _"if the enemies all swung at the PCs right now, who would drop?"_ — narrow, per-pair, no turn order, no tactics.

The Monte Carlo simulation answers: _"if we played out this encounter many times under explicit assumptions, what tends to happen?"_ — broader, full encounter, configurable tactics. Headline metrics:

**v0.9.0 change:** "Any PC down" and per-PC "Down" are `everDowned` metrics — a PC counts as down if it was at 0 HP at _any point_ in the iteration, even if healed back up before the iteration ended. TPK and per-PC death are still end-of-iteration state. The high-risk banner's trigger changed accordingly: it now fires on death risk (TPK ≥ 35% or any PC's death chance ≥ 35%), not on any-PC-down, since knockouts are routine in PF2e and would otherwise trip the banner on almost every encounter.

- **Any-PC-down probability** — fraction of iterations where at least one PC was at 0 HP at any point, whether or not it was later healed back up.
- **TPK probability** — fraction of iterations where every PC was downed at the end of the iteration.
- **Expected first-down round** — mean / median round in which the first PC dropped.
- **Per-PC down and death rates** — "down" uses the same at-any-point semantics as any-PC-down; "death" is end-of-iteration. Also reports mean ending HP and biggest contributing enemy.
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

### PC Strike synthesis (v0.9.0)

**v0.9.0 change:** PC Strike attack bonus and damage are now read/synthesized from actor data rather than left as a rc.3 approximation.

- **Attack bonus** is the PF2e-compiled strike's `totalModifier` — the same number the PF2e sheet shows for that Strike, proficiency and all.
- **Damage** is synthesized as weapon dice (`item.system.damage.dice` + the `runes.striking` value) plus an ability modifier:
  - Melee and thrown Strikes use **STR** — finesse changes the attack roll's ability, not the damage die's ability, so it does not change damage here.
  - Melee and thrown Strikes use **DEX instead when the actor has a thief-racket item and DEX is higher** than STR (the rogue Thief racket's "use DEX for damage" benefit).
  - Ranged, non-thrown Strikes get **no ability modifier**, except **propulsive** weapons, which add `floor(STR / 2)` when STR is positive.
- The **striking rune** is read only from the remaster `runes.striking` field; legacy striking-as-trait data is not read.
- Weapon specialization and property runes (other than striking) are **not** included in the synthesized damage.
- Each PC that used synthesis surfaces the relevant assumption string in the Forecast's "Other modeling assumptions" so a GM can see when a Strike's damage was synthesized versus read directly from `actor.system.actions`.

### Iterations and stability

**v0.9.0 change:** the Forecast runs a fixed 5,000 iterations (±1.4% on any-PC-down); the engine caps at 10,000. There is no iteration-count or seed control in the UI.

The Forecast runs a fixed 5,000 iterations (±1.4% on any-PC-down); the engine caps at 10,000. That standard error band is why a 1k-vs-1k comparison used to feel noisy — at 5,000 iterations any-PC-down is stable to roughly ±1.4 percentage points, tight enough for GM decision-making without the wall-clock cost of 10k.

Internally, the runner still derives a per-iteration sub-seed from a master seed, so a given master seed + setup + config always produces a byte-identical `SimulationResult` — the UI uses a fresh seed each run; tests pass explicit seeds.

### PC survival mechanics (v0.6.0-rc.4)

**v0.9.0 change:** the recovery-check step sizes and the healing table below were corrected (recovery crit-failure was previously misdocumented as +1 instead of +2, and Battle Medicine now follows the full four-DC Treat Wounds table rather than a single flat DC); the dying/Wounded interaction and the stabilized-PC-hit-again case are now spelled out explicitly; the Heal cantrip bullet is removed because no such spell exists in PF2e.

rc.4 ships Phase I-A of the PC survival work: healing, recovery checks, and Hero Point death prevention. Reactions (Shield Block, Champion) are reserved for rc.5 Phase I-B.

- **Recovery checks.** At the start of each dying PC's turn, the engine rolls a PF2e flat check (1d20 vs DC 10+dying). Crit-success / success / failure / crit-failure step dying by **−2 / −1 / +1 / +2**. Most dying PCs recover within 1–2 rounds without intervention, which dramatically cuts the rc.3 "drop once, die" cascade.
- **Healing actions** (when extracted from the PC's actor data):
  - **Battle Medicine** follows the PF2e Treat Wounds table: the healer attempts the highest DC their Medicine proficiency allows that they still succeed on at least half their rolls against (DC 15 trained / 20 expert / 30 master / 40 legendary). Healing scales with the chosen DC: crit-success heals 4d8 plus the DC's bonus (+0 / +10 / +30 / +50); success heals 2d8 plus the same bonus; failure heals 0; crit-failure heals 0 and deals 1d8 to the target. 1/target/day per PF2e.
  - **Heal spell** — 1-action heals `<rank>d8` (touch, single target); 2-action heals `<rank>d8 + 8×<rank>` (30 ft). Consumes a prepared slot (or a spontaneous slot of that rank). Heal cast on a dying target also clears dying, per the dying rules below. 3-action Heal (the mass-heal burst) is **not modeled**.
  - There is no Heal cantrip in PF2e — the closest at-will option is Stabilize, which is also not modeled.
- **PC tactics decision tree** runs each PC turn:
  1. _Emergency heal_ — any standing ally is dying. Full-turn 2-action heal on the most-dying ally. No Strikes that round.
  2. _Top-up heal_ — any ally below 40% HP (and not dying). 1-action heal + 1-action Strike.
  3. _Default_ — 2 Strikes at the most-dangerous standing enemy.
     Healer preference: Heal spell 2-action > 1-action variant > Battle Medicine. Slot economy: spell slots decrement; Battle Medicine respects per-target restriction.
- **Hero Point death prevention** — when a PC would die (`dying >= deathThreshold`), spend a Hero Point to drop to dying 0 at 0 HP. Capped at one Hero Point survival per iteration per PC. Eliminates the one-bad-roll TPK pattern rc.3 still produced. Per PF2e RAW, this does **not** add Wounded — Wounded only increases when dying is lost through healing or a recovery check, not through Hero Point avoidance.

The combination cuts rc.3's TPK rate for the canonical 3-PC vs 2-enemy "Low Threat" encounter from ~32% (focus-fire) to ~2%, matching GM intuition for a PF2e Low-Threat encounter with a healer in the party.

### Dying and Wounded (v0.9.0)

- Any healing that brings a PC to 1+ HP clears dying entirely and wakes the PC, regardless of how much dying they had.
- Losing dying — whether by healing to 1+ HP or by a successful recovery check reaching 0 — increases Wounded by 1. Hero Point death avoidance is the one exception: it does not touch Wounded.
- A stabilized PC sitting at 0 HP (dying 0, downed) who is hit again re-enters dying at **1 + Wounded** on a normal hit, or **2 + Wounded** on a critical hit — the same formula as the first time they were downed, using whatever Wounded value they are carrying now.
- Recovery check degrees of success step dying by −2 / −1 / +1 / +2 (crit success / success / failure / crit failure); see "Recovery checks" above.

### Explicitly not modeled in v0.6.0

PC actions, healing, recovery, and Hero Point survival are all modeled as of rc.4.

- **Reactions** (rc.5). Shield Block, Champion reactions (Liberator/Redeemer/Paladin) — coming in rc.5. Attacks of opportunity defer to v0.7.0+.
- **Spells beyond Heal.** Enemies use Strikes only; PCs use Strikes + Heal. Save-based threats and offensive spells defer to v0.7.0+.
- **Persistent damage.** v0.8.0+.
- **Movement, reach, line of sight.** The simulation assumes everyone can reach everyone.
- **Initiative-altering abilities.** Delay, Ready, surprise rounds, and feats that move initiative are not modeled.
- **PC multi-attack action economy beyond 2 Strikes/turn.** Real PCs sometimes Strike 3 times (third Strike at -10 MAP); rc.4 caps at 2.
- **Multi-encounter resource regeneration.** Heal spell slots and Battle Medicine targets are tracked within a single iteration but do not refresh between iterations — that's correct for single-encounter forecasts.

### How to interpret the numbers

The forecast is decision support, not prophecy.

- After rc.4, the simulation reflects realistic round counts (typically 2–4 rounds) AND a realistic safety net (healing, recovery, Hero Points). A "Low Threat" PF2e encounter with a healer in the party should now show low single-digit TPK risk; if it doesn't, the encounter likely has structural lethality worth examining.
- A 30% TPK probability is still a **model artifact**, not a 30% campaign-death chance. It's the probability under "no healing, no reactions, no Hero Points, fixed tactics for both sides." Real-table risk usually skews lower because PCs use Battle Medicine, Shield Block, Demoralize, and similar non-Strike actions the model does not yet simulate.
- Two Forecast runs of the same encounter can land a few points apart (roughly ±1.4% on any-PC-down at the fixed 5,000-iteration count) purely from RNG noise — that is expected, not a bug.
- Risk pills (Low / Guarded / Dangerous / Severe / Grim) use the same v0.5.0 thresholds; per-PC risk is mapped from each PC's own down probability.
- The biggest threat enemy is "who contributed the most absorbed damage across iterations," not necessarily "who's the dramatic villain."
- The Danger Board's per-pair view is still the right tool for "what's lethal _right now in a single turn_"; the Forecast answers the multi-round encounter question.

### Performance and the kill switch

**v0.9.0 change:** documented the round cap and its cap-rate caveat, and the "Default enemy Strike count" setting that now drives the Danger Board, Pair Detail, and the Forecast together.

The simulation runs in a Web Worker so the Foundry main thread stays responsive even at 10k iterations. Progress events are throttled to ~10/sec to avoid postMessage flooding. Aborting a run mid-flight returns a partial result flagged `aborted: true` rather than discarding everything.

Every iteration also has a hard **round cap of 10** (`DEFAULT_MAX_ROUNDS`) as a backstop against true stalemates — most fights end well before that on their own now that PCs act. An iteration that reaches the cap is counted rather than silently truncated: if any runs hit it, the Forecast reports a caveat such as "N% of runs reached the 10-round cap; those results may understate the true outcome."

A world (GM-only) setting, **Default enemy Strike count**, sets how many Strikes each enemy makes per turn. It drives three things together: the Encounter Danger Board's per-pair math, the Pair Detail panel's starting Strike count, and the number of Strikes simulated enemies make per turn in the Forecast. PCs are unaffected by this setting — they always make 2 Strikes per turn (see "PC tactics" above).

A per-client setting in **Configure Settings → Module Settings → Grim Arithmetic** — **Enable Monte Carlo encounter simulation** — disables the feature entirely on machines where it's too costly. When the kill switch is off, the "Forecast encounter" button is hidden on the Danger Board and no Worker is constructed. The v0.5.0 danger board behavior is unchanged either way.

---

## Implementation references

Current calculation code lives in:

```text
src/engine/degree-of-success.ts
src/engine/attack-probability.ts
src/engine/dice.ts
src/engine/mortality.ts
src/engine/critical-damage.ts
src/engine/encounter-risk.ts
src/engine/prng.ts
src/engine/risk-bands.ts
src/engine/risk-controls.ts
src/engine/statistics.ts
src/engine/simulation-types.ts
src/engine/sample-strike.ts
src/engine/sim-state.ts
src/engine/heal-actions.ts
src/engine/sample-recovery.ts
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
src/ui/forecast-panel-data.ts
src/systems/adapter-registry.ts
src/systems/pf2e-adapter.ts
src/systems/pf2e-pc-strikes.ts
src/systems/pf2e-pc-capabilities.ts
```

Current tests live in:

```text
tests/adapter-registry.test.ts
tests/attack-probability.test.ts
tests/critical-damage.test.ts
tests/damage-adjustments.test.ts
tests/danger-board.test.ts
tests/debounce.test.ts
tests/debug-capture.test.ts
tests/degree-of-success.test.ts
tests/dice.test.ts
tests/encounter-guardrail.test.ts
tests/encounter-participants.test.ts
tests/encounter-risk.test.ts
tests/encounter-setup.test.ts
tests/forecast-panel-data.test.ts
tests/heal-actions.test.ts
tests/initiative.test.ts
tests/live-fixtures.test.ts
tests/mortality.test.ts
tests/pair-detail-panel.test.ts
tests/panel-data.test.ts
tests/pf2e-adapter-pc-healing.test.ts
tests/pf2e-adapter-pc-strikes.test.ts
tests/pf2e-adapter.test.ts
tests/pf2e-table-fixtures.test.ts
tests/prng.test.ts
tests/record-utils.test.ts
tests/release-package.test.ts
tests/risk-bands.test.ts
tests/risk-tooltip.test.ts
tests/run-iteration.test.ts
tests/run-simulation-in-worker.test.ts
tests/run-simulation.test.ts
tests/sample-recovery.test.ts
tests/sample-strike.test.ts
tests/selection.test.ts
tests/settings.test.ts
tests/sim-state.test.ts
tests/simulation-fixtures.test.ts
tests/simulation-guardrails.test.ts
tests/simulation-types.test.ts
tests/statistics.test.ts
tests/tactics/pc-default.test.ts
tests/tactics/tactics.test.ts
tests/tooltip-delay.test.ts
```
