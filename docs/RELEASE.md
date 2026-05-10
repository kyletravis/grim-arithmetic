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
docs/
```

It intentionally excludes source, tests, `.git/`, `node_modules/`, and other development-only files.

## Tagging

Create annotated release tags from the repo where the commit exists:

```bash
git status --short
git tag -a vX.Y.Z -m "Grim Arithmetic vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

If a tag was created on another clone, fetch tags instead of recreating it:

```bash
git fetch --tags origin
git tag --list 'v*'
```

## GitHub Release assets

Create a GitHub Release from the matching tag and attach both generated files:

```bash
gh release create vX.Y.Z \
  releases/grim-arithmetic-vX.Y.Z.zip \
  releases/module.json \
  --title "Grim Arithmetic vX.Y.Z" \
  --notes-file CHANGELOG.md
```

If using the GitHub web UI instead, upload these two files from `releases/`:

```text
module.json
grim-arithmetic-vX.Y.Z.zip
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
