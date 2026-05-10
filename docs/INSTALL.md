# Installing Grim Arithmetic on a Foundry VTT Server

This guide covers installing the current development build of **Grim Arithmetic** on a Foundry VTT server for manual testing.

Current target:

- Foundry VTT: **v13 Build 351 minimum**
- Manifest compatibility generation: `minimum: "13"`, `verified: "13"` for Foundry package discovery compatibility
- System: **Pathfinder 2e (`pf2e`)**
- Module ID/folder name: `grim-arithmetic`

> Grim Arithmetic is not packaged as a release yet. For now, install it by copying or syncing this repository into Foundry’s `Data/modules/grim-arithmetic/` directory.

---

## 1. Build the module locally

From your Mac/local development checkout:

```bash
cd /Users/kyle/git/grim-arithmetic
npm install
npm run check
```

Expected:

- ESLint passes.
- Vitest passes.
- Vite build passes.
- `dist/grim-arithmetic.js` exists.

Quick verification:

```bash
test -f module.json
test -f dist/grim-arithmetic.js
test -f templates/mortality-panel.hbs
test -f styles/grim-arithmetic.css
```

---

## 2. Identify the Foundry Data path

Common Foundry server layouts:

```text
~/foundrydata/Data
~/FoundryVTT/Data
/opt/foundrydata/Data
/home/<user>/foundrydata/Data
```

The module must land at:

```text
<FOUNDRY_DATA>/Data/modules/grim-arithmetic/
```

The folder name should match the manifest ID:

```json
"id": "grim-arithmetic"
```

---

## 3. Install option A — rsync from local Mac to server

Use this when testing on a remote Proxmox-hosted Foundry server.

Set these variables in your terminal, replacing the host/path values:

```bash
LOCAL_REPO="/Users/kyle/git/grim-arithmetic"
FOUNDRY_HOST="your-foundry-host-or-ip"
FOUNDRY_USER="your-ssh-user"
FOUNDRY_DATA="/home/your-ssh-user/foundrydata/Data"
REMOTE_MODULE_DIR="$FOUNDRY_DATA/modules/grim-arithmetic"
```

Build locally first:

```bash
cd "$LOCAL_REPO"
npm run check
```

Create the remote module directory:

```bash
ssh "$FOUNDRY_USER@$FOUNDRY_HOST" "mkdir -p '$REMOTE_MODULE_DIR'"
```

Sync only the files Foundry needs plus useful docs:

```bash
rsync -av --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'coverage/' \
  --exclude '.env' \
  "$LOCAL_REPO/" \
  "$FOUNDRY_USER@$FOUNDRY_HOST:$REMOTE_MODULE_DIR/"
```

Verify remotely:

```bash
ssh "$FOUNDRY_USER@$FOUNDRY_HOST" "
  set -e
  test -f '$REMOTE_MODULE_DIR/module.json'
  test -f '$REMOTE_MODULE_DIR/dist/grim-arithmetic.js'
  test -f '$REMOTE_MODULE_DIR/templates/mortality-panel.hbs'
  test -f '$REMOTE_MODULE_DIR/styles/grim-arithmetic.css'
  python3 -m json.tool '$REMOTE_MODULE_DIR/module.json' >/dev/null
  echo 'Grim Arithmetic files look good.'
"
```

### SSH/fail2ban caution

If the Foundry server uses fail2ban, avoid rapid-fire repeated SSH reconnects. Prefer batched commands like the examples above. If SSH suddenly times out while ping still works, wait a few minutes before retrying.

---

## 4. Install option B — clone or copy directly on the server

Use this if the server has Git and Node available.

```bash
FOUNDRY_DATA="$HOME/foundrydata/Data"
mkdir -p "$FOUNDRY_DATA/modules"
cd "$FOUNDRY_DATA/modules"
git clone <repo-url> grim-arithmetic
cd grim-arithmetic
npm install
npm run check
```

This is convenient, but for early private testing rsync from the Mac is often simpler.

---

## 5. Restart Foundry

After adding a module to the filesystem, do a full Foundry server restart. A browser refresh is not always enough for new module discovery.

Examples, depending on deployment:

```bash
# systemd-style deployment
systemctl --user restart foundryvtt

# or, if running as root/system service
sudo systemctl restart foundryvtt

# Docker-style deployment
cd /path/to/docker-compose-dir
docker compose restart foundry
```

Use whatever matches your Proxmox Foundry deployment.

---

## 6. Enable the module in a PF2e world

1. Open Foundry in the browser.
2. Launch a **PF2e** world.
3. Go to **Game Settings → Manage Modules**.
4. Find **Grim Arithmetic**.
5. Enable it.
6. Save module settings / reload world if prompted.

Expected:

- The module appears as **Grim Arithmetic**.
- No manifest validation error appears.
- Browser console logs:

```text
Grim Arithmetic | Initializing
```

---

## 7. Quick smoke test

In a PF2e scene:

1. Place one PC token.
2. Place one hostile NPC token with at least one melee Strike.
3. Select the PC token.
4. Target the NPC token.
5. Open the Token Controls toolbar.
6. Click the skull icon for **Grim Arithmetic**.

Expected:

- A Grim Arithmetic panel opens.
- The panel header shows the current module version, e.g. `Grim Arithmetic v0.3.0`.
- It shows the PC vs enemy name.
- It shows an enemy Strike selector plus the selected Strike, attack bonus, and damage formula.
- It shows damage range, average damage, and damage swinginess.
- It shows down chance and risk label.
- It shows a damage adjustment note for resistance/weakness/immunity handling.
- It shows dying severity, doomed-adjusted death threshold, immediate death flag, and Hero Point note.
- It shows assumptions and not-modeled caveats.
- It explicitly says permanent death probability is not modeled in MVP.

If the panel says it cannot find a supported melee Strike, continue to the testing guide and use `game.modules.get('grim-arithmetic')?.api?.captureTokenDebug?.(...)` to capture the sanitized actor data shape.

---

## 8. Troubleshooting

### Module does not appear in Manage Modules

If Grim Arithmetic does not appear anywhere after a restart, Foundry is not discovering a valid module manifest. This is almost always one of: wrong data path, nested folder, folder/id mismatch, permissions, or manifest validation failure.

Run this on the Foundry server, adjusting `FOUNDRY_DATA` if needed:

```bash
FOUNDRY_DATA="$HOME/foundrydata/Data"
MODULE_DIR="$FOUNDRY_DATA/modules/grim-arithmetic"

printf 'Module dir: %s\n' "$MODULE_DIR"
ls -la "$MODULE_DIR"
printf '\nmodule.json:\n'
python3 -m json.tool "$MODULE_DIR/module.json"
printf '\nKey files:\n'
find "$MODULE_DIR" -maxdepth 2 -type f | sort | sed "s|$MODULE_DIR/||"
printf '\nPermissions:\n'
namei -l "$MODULE_DIR/module.json" 2>/dev/null || true
```

Expected key files:

```text
module.json
dist/grim-arithmetic.js
styles/grim-arithmetic.css
templates/mortality-panel.hbs
```

Also verify there is **not** an extra nested repo folder:

```bash
test ! -f "$MODULE_DIR/grim-arithmetic/module.json" || echo 'Nested folder problem detected'
```

Common causes:

- Folder is not named `grim-arithmetic`.
- `module.json` is missing or invalid.
- Files were copied one level too deep, e.g. `modules/grim-arithmetic/grim-arithmetic/module.json`.
- Foundry is using a different user data path than the one you copied into.
- The Foundry service user cannot read the module folder/files.
- Foundry was not fully restarted after install.

Check the active user data path in the Foundry UI if possible: **Configuration → User Data Path**.

For systemd installs, also inspect the service command/environment:

```bash
systemctl status foundryvtt --no-pager
systemctl cat foundryvtt
```

Look for `--dataPath`, `FOUNDRY_VTT_DATA_PATH`, or similar.

### Browser console has runtime errors

Open browser dev tools and look for errors beginning with:

```text
Grim Arithmetic
```

Also check whether Foundry v13 APIs differ from our first implementation around:

- `Application`
- `Hooks.on('getSceneControlButtons', ...)`
- token controls format
- `game.modules.get('grim-arithmetic').api`

### Server logs show manifest/module validation errors

On Linux-style Foundry data paths, logs often live under:

```text
~/foundrydata/Logs/debug.YYYY-MM-DD.log
```

Example grep:

```bash
grep -i "grim-arithmetic\|validation\|module" ~/foundrydata/Logs/debug.$(date +%Y-%m-%d).log | tail -80
```

### Panel opens but cannot extract PF2e data

The current adapter expects first-pass PF2e data paths such as:

- PC HP: `actor.system.attributes.hp.value/max/temp`
- PC AC: `actor.system.attributes.ac.value`
- NPC melee items: `actor.items` entries where `type === 'melee'`
- Strike attack bonus: `item.system.bonus.value` or `item.system.attack.value`
- Strike damage: first `item.system.damageRolls.*.damage` or `.formula`

If the real PF2e system uses a different shape, capture the debug snippets in `docs/TESTING.md` and we will patch `src/systems/pf2e-adapter.ts`.

---

## 9. Updating after code changes

After making local code changes:

```bash
cd /Users/kyle/git/grim-arithmetic
npm run check
rsync -av --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'coverage/' \
  --exclude '.env' \
  /Users/kyle/git/grim-arithmetic/ \
  "$FOUNDRY_USER@$FOUNDRY_HOST:$REMOTE_MODULE_DIR/"
```

Then restart Foundry or reload the world depending on whether the manifest changed. For JavaScript-only changes, a browser hard refresh may be enough, but a world reload is safer during early testing.
