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
4. Build and test:

   ```bash
   npm run check
   ```

5. Confirm the panel header shows `Grim Arithmetic vX.Y.Z` after deployment.

## Tagging

Create annotated release tags from the repo where the commit exists:

```bash
git status --short
git tag -a v0.1.1 -m "v0.1.1"
git push origin main
git push origin v0.1.1
```

If a tag was created on another clone, fetch tags instead of recreating it:

```bash
git fetch --tags origin
git tag --list 'v*'
```

## Foundry server clone

If testing from a server-side clone instead of rsync, normalize the remote there too:

```bash
cd ~/foundrydata/Data/modules/grim-arithmetic
git remote set-url origin git@github.com:kyletravis/grim-arithmetic.git
git fetch origin --tags
git status --short
```

Use the same `npm run check` gate before treating a server checkout as release-ready.
