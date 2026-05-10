# Grim Arithmetic Calculation Guide

> **Purpose:** Explain, in plain English and implementation-level detail, what goes into Grim Arithmetic's risk calculation.  
> **Current baseline:** v0.1.x MVP  
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
- average damage from supported dice formulas
- simple doubled damage on critical hits
- cumulative damage across the modeled Strike sequence

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
- exact dice distributions
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

The MVP uses the enemy's first supported melee Strike. For that Strike, it extracts:

- Strike name
- attack bonus
- damage formula
- MAP type if detectable:
  - `normal`
  - `agile`
  - `unknown`, which defaults to normal MAP in Auto mode

A future version will let the GM choose among multiple extracted Strikes.

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

## Damage math in the MVP

The current MVP uses **average damage**, not an exact roll distribution.

Supported formulas are simple additive/subtractive dice expressions, such as:

```text
1d8
2d6+4
2d8 + 6
1d12+1d6+3
```

Unsupported formulas include typed/tagged or conditional PF2e expressions such as:

```text
2d8[persistent,fire]+4
1d8+1d6 precision
1d10 plus Grab
```

### Average die value

The average value of one die is:

```text
average of dN = (N + 1) / 2
```

Examples:

```text
average d4  = 2.5
average d6  = 3.5
average d8  = 4.5
average d10 = 5.5
average d12 = 6.5
```

### Average formula examples

```text
1d8+4 = 4.5 + 4 = 8.5
2d6+3 = 3.5 + 3.5 + 3 = 10
1d12+1d6+3 = 6.5 + 3.5 + 3 = 13
```

### Critical damage in the MVP

Critical damage is modeled as simple doubled average damage:

```text
crit damage = average damage × 2
```

For example:

```text
normal average damage: 8.5
critical average damage: 17
```

This is intentionally simplified. PF2e traits like deadly and fatal are not modeled yet.

---

## Expected damage

For each Strike, Grim Arithmetic computes expected damage:

```text
expected damage from Strike =
  success probability × average hit damage
+ critical success probability × average critical damage
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

Important: expected HP is an average-like summary. It is not the same thing as down probability.

---

## Down probability

The down probability answers:

```text
What fraction of modeled attack outcome sequences deal damage >= modeled HP?
```

The MVP treats each Strike as having three damage branches:

```text
miss branch: 0 damage
hit branch: average damage
crit branch: average damage × 2
```

The probability of the miss branch is:

```text
failure probability + critical failure probability
```

The probability of the hit branch is:

```text
success probability
```

The probability of the crit branch is:

```text
critical success probability
```

For one Strike, the down probability is the sum of branches where damage is at least the PC's modeled HP.

For multiple Strikes, Grim Arithmetic expands all cumulative damage states.

Example for two Strikes:

```text
Strike 1 miss + Strike 2 miss
Strike 1 miss + Strike 2 hit
Strike 1 miss + Strike 2 crit
Strike 1 hit  + Strike 2 miss
Strike 1 hit  + Strike 2 hit
Strike 1 hit  + Strike 2 crit
Strike 1 crit + Strike 2 miss
Strike 1 crit + Strike 2 hit
Strike 1 crit + Strike 2 crit
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

This is one reason exact dice distributions are planned for v0.2.0: average damage is useful but can hide swinginess.

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
PC modeled HP: 18
PC effective AC: 22
Enemy attack bonus: +12
Enemy damage: 1d8+4
Enemy turn model: 2 Strikes
MAP: normal
```

### Step 1: damage average

```text
1d8+4 = 4.5 + 4 = 8.5
crit damage = 8.5 × 2 = 17
```

### Step 2: first Strike probabilities

First Strike attack bonus is +12.

```text
attack total = d20 + 12
AC = 22
```

The engine evaluates all d20 rolls and applies PF2e natural 20/natural 1 rules. The result might be something like:

```text
hit chance: 50%
crit chance: 5%
```

### Step 3: second Strike probabilities

Normal MAP applies -5 to the second Strike.

```text
second attack total = d20 + 7
AC = 22
```

The hit and crit chances drop accordingly.

### Step 4: cumulative down check

A single crit deals 17 average damage, which is not enough to down an 18 HP PC.

But two hits deal:

```text
8.5 + 8.5 = 17
```

Still not enough.

A hit plus a crit deals:

```text
8.5 + 17 = 25.5
```

That does down the PC.

So Grim Arithmetic sums the probabilities of all two-Strike paths that include enough cumulative average damage to reach 18 or more.

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

### v0.1.1 planned documentation updates

- Strike selector behavior.
- Refresh/recalculate behavior.
- Improved error messages.
- Debug capture helper and fixture workflow.

### v0.2.0 planned documentation updates

- Exact dice distribution calculations.
- Probability mass functions.
- Cumulative distribution handling across multiple Strikes.
- Damage range and swinginess interpretation.

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
src/ui/mortality-panel.ts
src/systems/pf2e-adapter.ts
```

Current tests live in:

```text
tests/degree-of-success.test.ts
tests/attack-probability.test.ts
tests/dice.test.ts
tests/mortality.test.ts
tests/pf2e-adapter.test.ts
```
