# Testing Grim Arithmetic in Foundry VTT v13 / PF2e

This guide walks through a manual test pass for Grim Arithmetic on a real Foundry VTT v13.351+ PF2e server.

Use this after following [INSTALL.md](./INSTALL.md).

---

## 1. Test environment record

Before testing, record the environment. This makes bug reports much easier.

```text
Date:
Tester:
Server/host:
Foundry version/build:
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
- [ ] Header shows `Grim Arithmetic v0.2.0` or the current `module.json` version.
- [ ] Header shows `PC name vs NPC name`.
- [ ] Enemy Strike selector lists supported melee Strikes.
- [ ] Enemy Strike line shows selected Strike name, attack bonus, and damage formula.
- [ ] Modeled HP appears.
- [ ] Effective AC appears.
- [ ] Wounded display appears.
- [ ] Damage range, average damage, and swinginess appear.
- [ ] Down chance appears as a percentage.
- [ ] Risk label appears.
- [ ] Expected HP after turn appears.
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
- [ ] Assumptions say wounded override is display-only for now.
- [ ] Down chance does not need to change yet.

---

## 6. PF2e actor-data debug capture

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

## 7. Server-side log capture

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

## 8. Known MVP limitations

These are expected right now:

- Permanent death probability is not modeled.
- Wounded override is display-only.
- Damage uses exact dice distributions for supported formulas.
- Critical damage is simple double damage of the supported formula total.
- Resistance, weakness, immunity, deadly, fatal, precision, splash, and persistent damage are not modeled.
- Reactions such as Shield Block or Champion reactions are not modeled.
- Healing before/during enemy turn is not modeled.
- Enemy Strike selection is supported for extracted melee Strikes, but complex conditional Strike modifiers are not modeled.
- PF2e Strike extraction is hardened for common table-test shapes but may still need patching after unusual actor data review.

---

## 9. Bug report template

```md
## Grim Arithmetic Test Report

**Date:**
**Tester:**
**Foundry version/build:**
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

## 10. Pass/fail criteria for current build

A passing first external test means:

- [ ] Module installs on the Foundry server.
- [ ] Module enables in a PF2e world.
- [ ] GM sees the skull button.
- [ ] Panel opens with no selection and reports useful errors.
- [ ] Panel opens for selected PC + targeted NPC.
- [ ] If actor extraction succeeds, panel displays a down-risk estimate.
- [ ] If actor extraction fails, captured debug data is enough to patch the adapter.

Either outcome is useful. If extraction fails, the next task is simply to update `src/systems/pf2e-adapter.ts` against real PF2e v13 actor data.
