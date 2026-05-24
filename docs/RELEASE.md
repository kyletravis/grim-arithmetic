# Grim Arithmetic Release Notes / Tag Workflow

This repo uses GitHub as the canonical remote:

```bash
git remote set-url origin git@github.com:kyletravis/grim-arithmetic.git
git remote -v
```

Expected:

```text
origin  git@github.com:kyletravis/grim-arithmetic.git (fetch)
origin  git@github.com:kyletravis/grim-arithmetic.git (push)
```

## Version bump checklist

1. Update `package.json`.
2. Update `package-lock.json` root package versions.
3. Update `module.json`.
4. Ensure `module.json` release URLs match the version:

   ```json
   {
     "url": "https://github.com/kyletravis/grim-arithmetic",
     "manifest": "https://github.com/kyletravis/grim-arithmetic/releases/latest/download/module.json",
     "download": "https://github.com/kyletravis/grim-arithmetic/releases/download/vX.Y.Z/grim-arithmetic-vX.Y.Z.zip"
   }
   ```

5. Update `CHANGELOG.md`.
6. Build and test:

   ```bash
   npm run check
   npm run package
   ```

7. Confirm the panel header shows `Grim Arithmetic vX.Y.Z` after deployment.

## Release package contents

`npm run package` builds:

```text
releases/module.json
releases/grim-arithmetic-vX.Y.Z.zip
```

The zip is a direct Foundry module install archive with files at the zip root:

```text
module.json
dist/
styles/
templates/
README.md
LICENSE
CHANGELOG.md
```

It intentionally excludes source, tests, `.git/`, `node_modules/`, `docs/`, and other development-only files. (Documentation lives in `docs/` on GitHub and is not bundled into the install archive.)

## Release pipeline (CI) and the manual gate

Releases are published by `.github/workflows/release.yml`, triggered **only** by pushing a
`v*` tag. Pushing the tag *is* the human gate — never push it until the locally built zip has
passed on a real Foundry server. The flow:

```text
bump version + CHANGELOG, commit, push main   -> test.yml runs lint + test + build
npm run package                                -> local releases/grim-arithmetic-vX.Y.Z.zip
INSTALL THAT ZIP ON THE FOUNDRY SERVER, TEST   <-- the gate; nothing ships until this passes
git tag -a vX.Y.Z -m "Grim Arithmetic vX.Y.Z"
git push origin main && git push origin vX.Y.Z -> release.yml builds + publishes the Release
```

On the tag push, `release.yml`:

1. Verifies the tag matches `package.json` version (fails fast on mismatch).
2. Runs `npm ci`, `npm run check`, `npm run package` on the tagged commit.
3. Marks the Release as a **prerelease** automatically if the tag contains `-rc`/`-beta`/`-alpha`.
4. Creates the GitHub Release with notes from this version's `CHANGELOG.md` section, attaching
   `grim-arithmetic-vX.Y.Z.zip` and `module.json`.

Because CI rebuilds from the exact tagged commit with the pinned lockfile, the published zip
matches what you tested. `dist/` is no longer committed — CI and `npm run package` build it.

### Tagging notes

If a tag was created on another clone, fetch tags instead of recreating it:

```bash
git fetch --tags origin
git tag --list 'v*'
```

### Manual fallback (only if CI is unavailable)

```bash
gh release create vX.Y.Z \
  releases/grim-arithmetic-vX.Y.Z.zip \
  releases/module.json \
  --title "Grim Arithmetic vX.Y.Z" \
  --notes-file CHANGELOG.md
```

## Manifest install URLs

Latest release install URL:

```text
https://github.com/kyletravis/grim-arithmetic/releases/latest/download/module.json
```

Version-pinned install URL:

```text
https://github.com/kyletravis/grim-arithmetic/releases/download/vX.Y.Z/module.json
```

Foundry reads the release `module.json`, then downloads the zip from that manifest's `download` URL.

> Note: for unauthenticated Foundry installs, the GitHub repository/release assets must be public or otherwise reachable by the Foundry server.

## Foundry server clone

If testing from a server-side clone instead of manifest install, normalize the remote there too:

```bash
cd ~/foundrydata/Data/modules/grim-arithmetic
git remote set-url origin git@github.com:kyletravis/grim-arithmetic.git
git fetch origin --tags
git status --short
```

Use the same `npm run check` gate before treating a server checkout as release-ready.
