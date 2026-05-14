# Testing Grim Arithmetic in Foundry VTT v13/v14 / PF2e

This guide walks through a manual test pass for Grim Arithmetic on a real PF2e server. Grim Arithmetic targets Foundry VTT v13+ and has been initially smoke-tested on Foundry VTT v14.361.

Use this after following [INSTALL.md](./INSTALL.md).

---

## 1. Test environment record

Before testing, record the environment. This makes bug reports much easier.

```text
Date:
Tester:
Server/host:
Foundry version/build, e.g. v14.361:
PF2e system version:
Browser:
Grim Arithmetic commit:
Grim Arithmetic version shown in panel header:
World name:
Scene name:
PC token used:
NPC token used:
```

Get the current commit locally:

```bash
cd /Users/kyle/git/grim-arithmetic
git rev-parse --short HEAD
```

---

## 2. Basic module load checklist

In Foundry:

- [ ] Foundry launches successfully.
- [ ] PF2e world launches successfully.
- [ ] **Grim Arithmetic** appears in **Manage Modules**.
- [ ] Module enables without warning.
- [ ] World reloads after enabling.
- [ ] Browser console shows:

```text
Grim Arithmetic | Initializing
```

- [ ] No Grim Arithmetic errors appear in the browser console.
- [ ] Token controls include a skull icon for Grim Arithmetic when logged in as GM.

If the module does not appear, go back to [INSTALL.md troubleshooting](./INSTALL.md#8-troubleshooting).

---

## 3. Empty / invalid selection behavior

Open a scene with tokens available.

### Case A — no selected token, no target

Steps:

1. Clear selected tokens.
2. Clear targets.
3. Click the Grim Arithmetic skull button.

Expected:

- [ ] Panel opens.
- [ ] It says no PC token is selected and asks for one PC token.
- [ ] It says no target is selected and asks for one enemy token.
- [ ] It does not crash.

### Case B — selected PC, no target

Steps:

1. Select one PC token.
2. Clear targets.
3. Click the skull button.

Expected:

- [ ] Panel opens.
- [ ] It says no target is selected and asks for one enemy token.
- [ ] It does not crash.

### Case C — one PC selected, multiple targets

Steps:

1. Select one PC token.
2. Target two enemy tokens.
3. Click the skull button.

Expected:

- [ ] Panel opens.
- [ ] It says multiple targets are selected and asks for only one enemy token.
- [ ] It does not crash.

---

## 4. Happy-path immediate threat test

Setup:

- One PC token selected.
- One hostile NPC token targeted.
- NPC has at least one melee Strike.

Steps:

1. Select the PC token.
2. Target the NPC token.
3. Click the Grim Arithmetic skull button.

Expected:

- [ ] Panel opens.
- [ ] Header shows `Grim Arithmetic v0.3.0` or the current `module.json` version.
- [ ] Header shows `PC name vs NPC name`.
- [ ] Enemy Strike selector lists supported melee Strikes.
- [ ] Enemy Strike line shows selected Strike name, attack bonus, and damage formula.
- [ ] Modeled HP appears.
- [ ] Effective AC appears.
- [ ] Wounded display appears.
- [ ] Damage range, average damage, and swinginess appear.
- [ ] Damage adjustment note appears and does not claim adjustments when damage type is unknown.
- [ ] Down chance appears as a percentage.
- [ ] Risk label appears.
- [ ] Expected HP after turn appears.
- [ ] Dying if downed appears with normal-hit and crit values.
- [ ] Death threshold appears with doomed value.
- [ ] Immediate death flag appears.
- [ ] Hero Point note appears.
- [ ] Strike hit/crit chances appear.
- [ ] Assumptions appear.
- [ ] Not-modeled caveats appear.
- [ ] Permanent death is clearly marked as not modeled in MVP.

Record observed values:

```text
PC:
NPC:
Strike:
Attack bonus:
Damage formula:
Modeled HP:
Effective AC:
Down chance:
Risk label:
Expected HP after turn:
Damage adjustment note:
Dying if downed:
Death threshold:
Immediate death flag:
Hero Point note:
Strike hit/crit lines:
Unexpected issues:
```

---

## 5. Control behavior tests

With the same PC/NPC pair and the panel open:

### Enemy Strike selector

If the targeted NPC has multiple supported melee Strikes, change **Enemy Strike** between them.

Expected:

- [ ] The selected Strike line changes.
- [ ] MAP auto mode follows the selected Strike's agile/normal trait.
- [ ] Down chance recalculates.
- [ ] Strike selection is preserved while changing other controls.

### Refresh / Recalculate

With the panel open, change token HP, targeting, or selection in Foundry, then click **Refresh / Recalculate**.

Expected:

- [ ] The panel re-reads current selection/target state.
- [ ] Modeled HP and risk values update without closing/reopening the panel.

### Enemy turn Strike count

Change **Enemy turn** between:

- 1 Strike
- 2 Strikes
- 3 Strikes

Expected:

- [ ] Strike chance list length changes accordingly.
- [ ] Down chance recalculates.
- [ ] Assumptions update to the selected Strike count.

### MAP mode

Change **MAP** between:

- Auto
- Normal
- Agile
- None

Expected:

- [ ] Hit/crit chances change when MAP mode changes.
- [ ] Down chance recalculates.
- [ ] Assumptions update to show the modeled MAP.

### Shield / AC adjustment

Change **Shield / AC adjustment** between:

- No shield bonus
- +1 AC
- +2 AC

Expected:

- [ ] Effective AC changes.
- [ ] Hit/crit chances usually decrease as AC increases.
- [ ] Down chance usually decreases or stays equal.
- [ ] Assumptions mention the shield/status AC adjustment.

### Wounded display

Change **Wounded display** between:

- Current actor value
- Wounded 0
- Wounded 1
- Wounded 2
- Wounded 3

Expected:

- [ ] Wounded line changes.
- [ ] Dying if downed changes by the selected wounded value.
- [ ] Immediate death flag updates when wounded reaches dangerous thresholds.
- [ ] Assumptions mention the wounded override when not using current actor value.
- [ ] Down chance does not need to change; wounded affects dying severity, not HP damage.

### Hero Point prevention

Change **Hero Point prevention** between:

- Use actor Hero Points
- Assume Hero Point available
- Assume no Hero Point

Expected:

- [ ] Hero Point note updates.
- [ ] Assumptions mention the Hero Point override when not using actor state.
- [ ] No permanent death percentage appears.

---

## 6. Encounter danger board + Pair detail (v0.5.0)

v0.5.0 splits the previous combined panel into **two windows**:

- **Encounter Danger Board** — main window opened by the Token Controls skull button.
- **Pair Detail** — separate popup window for the single-PC vs single-enemy detail view. One reusable instance; clicking another Detail button re-renders the same window with the new pair.

### Setup

- A scene with **at least 2 PC tokens** and **at least 2 hostile NPC tokens**, each NPC having at least one supported melee Strike.

### Case A — danger board, no token selection

Steps:

1. Start a combat encounter and add the PCs and NPCs to the tracker.
2. Clear all selected tokens. Clear all targets.
3. Click the Grim Arithmetic skull button.

Expected:

- [ ] Danger board window opens (title contains "Encounter Danger Board").
- [ ] **No** single-pair detail content is shown in this window.
- [ ] **Most endangered PCs** lists each PC at most once, sorted by their highest immediate down-risk against any hostile.
- [ ] **Most dangerous enemies** lists each hostile at most once, sorted by their worst pair against any PC.
- [ ] Each entry is formatted `PC vs Enemy Attack — XX% Label` and has its own **Detail** button.
- [ ] An "Open detail for selected PC + targeted enemy" button is present near the top.

### Case B — open detail from a danger board row

Steps:

1. With the danger board open from Case A, click the **Detail** button on the top "Most endangered PCs" row.

Expected:

- [ ] A new **Pair Detail** window opens (separate window).
- [ ] The detail window has the correct PC, enemy, and Strike preselected.
- [ ] The danger board window stays open and unchanged.
- [ ] Click the **Detail** button on a different row (different PC or different enemy).
- [ ] The **same** Pair Detail window re-renders with the new pair instead of opening a second window.

### Case C — open detail from selection + target

Steps:

1. Close any open Pair Detail window.
2. With the danger board open, select one PC token in the canvas and target one hostile NPC.
3. Click "Open detail for selected PC + targeted enemy" on the danger board.

Expected:

- [ ] Pair Detail window opens, populated with the selected PC and targeted enemy (the v0.4.x workflow).
- [ ] Numbers in the detail view match what previous releases produced for this PC × NPC × Strike triple.

### Case D — Pair Detail when canvas state changes

Steps:

1. With a Pair Detail window open from Case B, end the active combat or delete the PC token.
2. Click the danger board's **Refresh** button, then re-click a Detail row.

Expected:

- [ ] If the referenced token is gone, the Pair Detail window shows a friendly error ("PC token is no longer on the canvas…") instead of throwing.
- [ ] No console exceptions related to Grim Arithmetic.

### Case E — no combat active

Steps:

1. End the active combat encounter.
2. Click the skull button.

Expected:

- [ ] Danger board opens with the empty-state caveat ("No encounter-wide risk to show…").
- [ ] "Open detail for selected PC + targeted enemy" still works when a PC is selected and an enemy is targeted.

### Case F — large encounter guardrail

Steps:

1. With a scene that has many PCs and many hostiles such that PCs × hostile-attack-permutations would exceed 200, start combat and open the danger board.

Expected:

- [ ] Danger board reports "Encounter-wide risk was not computed (performance guardrail)…".
- [ ] Foundry does not freeze.
- [ ] "Open detail for selected PC + targeted enemy" still works.

Record observed values:

```text
PCs in combat:
Hostiles in combat:
Most endangered PCs (top 3):
Most dangerous enemies (top 3):
Detail-from-row worked?:
Detail-from-selection worked?:
Same detail window reused for multiple rows?:
Guardrail triggered?:
Unexpected issues:
```

---

## 7. PF2e actor-data debug capture

If Grim Arithmetic cannot extract HP, AC, or Strike data, capture sanitized actor shape information.

Open browser dev tools on the Foundry world and run these snippets.

### Selected PC token snapshot

```js
const pc = canvas.tokens.controlled[0];
game.modules.get('grim-arithmetic')?.api?.captureTokenDebug?.(pc);
```

### Targeted NPC token snapshot

```js
const enemy = Array.from(game.user.targets)[0];
game.modules.get('grim-arithmetic')?.api?.captureTokenDebug?.(enemy);
```

### Grim Arithmetic module API check

```js
console.log(game.modules.get('grim-arithmetic'));
game.modules.get('grim-arithmetic')?.api?.openPanel?.();
game.modules.get('grim-arithmetic')?.api?.captureTokenDebug?.(); // defaults to first selected token
```

When sharing debug output, avoid posting private campaign text if any item descriptions include spoilers. The most useful data is structure/keys, attack bonuses, and damage formula shapes.

---

## 8. Server-side log capture

On the Foundry server, inspect today’s logs. Adjust path if your deployment uses a different data directory.

```bash
grep -i "grim-arithmetic\|validation\|module" ~/foundrydata/Logs/debug.$(date +%Y-%m-%d).log | tail -120
```

Useful things to capture:

- manifest validation errors
- module load errors
- template load errors
- JavaScript import errors

---

## 9. Known MVP limitations

These are expected right now:

- Permanent death probability is not modeled.
- Wounded and doomed affect dying severity and immediate death flags, not down chance.
- Resistance, weakness, and immunity are applied only for confidently typed Strike damage.
- Ambiguous/mixed damage types, exceptions, and bypass rules are not modeled.
- Hero Point availability is displayed/caveated but not modeled as survival probability.
- Damage uses exact dice distributions for supported formulas.
- Critical damage is simple double damage of the supported formula total.
- Resistance, weakness, immunity, deadly, fatal, precision, splash, and persistent damage are not modeled.
- Reactions such as Shield Block or Champion reactions are not modeled.
- Healing before/during enemy turn is not modeled.
- Enemy Strike selection is supported for extracted melee Strikes, but complex conditional Strike modifiers are not modeled.
- PF2e Strike extraction is hardened for common table-test shapes but may still need patching after unusual actor data review.

---

## 10. Bug report template

```md
## Grim Arithmetic Test Report

**Date:**
**Tester:**
**Foundry version/build, e.g. v14.361:**
**PF2e system version:**
**Browser:**
**Grim Arithmetic commit:**

### Scenario

- PC token:
- NPC token:
- Strike/action expected:

### Expected


### Actual


### Browser console errors

```text
paste here
```

### Server log excerpts

```text
paste here
```

### Sanitized actor/item shape notes

```text
paste here
```

---

## 11. Pass/fail criteria for current build

A passing first external test means:

- [ ] Module installs on the Foundry server.
- [ ] Module enables in a PF2e world.
- [ ] GM sees the skull button.
- [ ] Panel opens with no selection and reports useful errors.
- [ ] Panel opens for selected PC + targeted NPC.
- [ ] If actor extraction succeeds, panel displays a down-risk estimate.
- [ ] If actor extraction fails, captured debug data is enough to patch the adapter.

Either outcome is useful. If extraction fails, the next task is simply to update `src/systems/pf2e-adapter.ts` against real PF2e actor data for the Foundry/PF2e version under test.
