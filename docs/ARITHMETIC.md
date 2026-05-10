# Grim Arithmetic Calculation Guide

> **Purpose:** Explain, in plain English and implementation-level detail, what goes into Grim Arithmetic's risk calculation.  
> **Current baseline:** v0.2.0 exact-distribution MVP
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

The current calculation does **not** model:

- permanent death probability
- recovery checks
- healing before or during the enemy turn
- Hero Point death prevention
- wounded/doomed effects on dying severity
- Shield Block damage prevention
- Champion reactions or other defensive reactions
- resistance, weakness, or immunity
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
- **Wounded value**, display-only right now

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

## Planned updates to this document

As backlog items land, update this guide with new sections.

### v0.3.0 planned documentation updates

- Entering dying from normal hits vs critical hits.
- Wounded and doomed effects.
- Hero Point assumptions.
- Difference between down-risk and immediate death flags.

### v0.4.0 planned documentation updates

- Resistance, weakness, and immunity application.
- Damage type extraction and ambiguity handling.
- Manual damage adjustment overrides.

### v0.5.0 planned documentation updates

- Encounter-wide pairwise risk ranking.
- Most endangered PC and most dangerous enemy calculations.

### v0.6.0+ planned documentation updates

- Monte Carlo simulation assumptions.
- Tactics profiles.
- Iteration counts, seeds, and confidence/stability guidance.

---

## Implementation references

Current calculation code lives in:

```text
src/engine/degree-of-success.ts
src/engine/attack-probability.ts
src/engine/dice.ts
src/engine/mortality.ts
src/ui/panel-data.ts
src/ui/mortality-panel.ts
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
```
