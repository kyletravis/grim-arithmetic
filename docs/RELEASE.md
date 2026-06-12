# Grim Arithmetic Release Process

## Version bump checklist

Version fields (`package.json`, `package-lock.json`, and `module.json` — both `version` and the
`download` URL) are now bumped by CI via `scripts/bump-version.mjs`. You do not touch version
numbers manually before cutting a release.

Before dispatching the Cut Release workflow, ensure:

1. **Code is merged and pushed to main.**
2. **`CHANGELOG.md` has a `## vX.Y.Z` section** for the version you are about to release.
   The Cut Release workflow validates this section exists and is non-empty; it fails immediately
   if missing. This is a deliberate guard so the release notes are never blank.
3. **Local testing is complete** (see the dev loop below).

`scripts/bump-version.mjs` can also be run locally to test or inspect the exact bump it would
make:

```bash
node scripts/bump-version.mjs 0.7.3-rc1
```

Note that this **writes** `package.json`, `package-lock.json`, and `module.json` in place — it
is not a dry run. Revert before dispatching the workflow:

```bash
git restore package.json package-lock.json module.json
```

Do not commit and push a local bump before dispatching: the Cut Release workflow requires the
target version to differ from `package.json`'s current version, so a pre-pushed bump fails the
version-already-current validation.

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

### Local dev loop (unchanged)

Iterate locally: edit code, run `npm run check` (lint + test + build), run `npm run package`,
install the resulting `releases/grim-arithmetic-vX.Y.Z.zip` on the Foundry server, and test.
Repeat until the feature is solid. Local zips never need CI and are never pushed to GitHub.
This loop is the testing environment; nothing ships until it passes.

### Cutting a release

When code is on main and local testing is done, dispatch the **Cut Release** workflow:

- **From the Actions tab:** Actions → Cut Release → Run workflow → enter version without a
  leading `v` (e.g. `0.7.3` or `0.7.3-rc1`) → Run workflow.
- **From the CLI:**
  ```bash
  gh workflow run cut-release.yml -f version=0.7.3-rc1
  ```

The workflow runs entirely in CI and does the following, in order:

1. **Validate inputs** — checks that the version string matches `X.Y.Z` or `X.Y.Z-<prerelease>`,
   that the tag `vX.Y.Z` does not already exist, that the input version differs from
   `package.json`'s current version (preventing a no-op dispatch), and that `CHANGELOG.md`
   contains a non-empty `## vX.Y.Z` section (fails with an error if missing).
2. **Build check** — runs `npm ci` and `npm run check` on the pre-bump tree. If the build is
   broken, nothing is mutated.
3. **Bump version files** — runs `node scripts/bump-version.mjs <version>`, which updates
   `package.json`, `package-lock.json`, and `module.json` (version field and download URL).
4. **Create a GitHub-signed commit on main** — calls GitHub's GraphQL
   `createCommitOnBranch` mutation with `GITHUB_TOKEN`. Commits created through GitHub's
   API are signed by GitHub's web-flow key, so they appear as `github-actions[bot]` with a
   green "Verified" badge — something a plain `git push` from a runner cannot produce.
5. **Create a lightweight tag** pointing at the signed commit (via the GitHub REST API).
6. **Call `release.yml`** directly (as a reusable workflow) to build and publish. This is
   necessary because tags created by Actions with `GITHUB_TOKEN` do not fire `on: push: tags`
   triggers (GitHub suppresses events from that token to prevent loops).

`release.yml` then checks out the tagged commit, re-runs `npm ci`, `npm run check`, and
`npm run package`, and creates the GitHub Release with release notes extracted from the
`## vX.Y.Z` CHANGELOG section, attaching `grim-arithmetic-vX.Y.Z.zip` and `module.json`.
Prerelease status is detected automatically: any tag containing `-rc`, `-beta`, or `-alpha`
is marked as a prerelease.

After the workflow completes, pull locally to pick up the bot's release commit:

```bash
git pull
```

**rc prereleases** are published as GitHub prereleases and do not affect `releases/latest`,
so the manifest URL that users install from is untouched by rc testing.

### Concurrency and recovery

Concurrent Cut Release dispatches are **queued**, not cancelled (`cancel-in-progress: false`).
This prevents a mid-flight run being killed after the bump commit lands but before the tag is
created. If a run does die in that window (commit on main, no tag), the next dispatch fails
the version-already-current validation. Fix by pushing the tag manually at the commit OID
printed in the failed run's log:

```bash
git push origin <oid>:refs/tags/v<version>
```

A tag pushed with user credentials fires the `on: push: tags` trigger in `release.yml`
directly, so the release publishes without re-dispatching Cut Release.

### Manual fallbacks

Pushing a `v*` tag directly still triggers `release.yml` (the tag-push path):

```bash
git tag vX.Y.Z <commit>
git push origin vX.Y.Z
```

Note: this path produces an unverified release unless the underlying commit and tag are
separately GPG-signed, because a plain `git push` from local credentials does not go through
GitHub's API signing.

Emergency fallback if CI is unavailable entirely:

```bash
gh release create vX.Y.Z \
  releases/grim-arithmetic-vX.Y.Z.zip \
  releases/module.json \
  --title "Grim Arithmetic vX.Y.Z" \
  --notes-file release-notes.md
```

Copy just this version's `## vX.Y.Z` section from `CHANGELOG.md` into `release-notes.md` first —
passing `CHANGELOG.md` directly would publish the entire changelog as the release body.

### Tagging notes

If a tag was created on another clone (or by CI), fetch tags instead of recreating it:

```bash
git fetch --tags origin
git tag --list 'v*'
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

## Repo setup

GitHub is the canonical remote. On any clone (development machine or server), normalize it once:

```bash
git remote set-url origin git@github.com:kyletravis/grim-arithmetic.git
git remote -v
```

Expected:

```text
origin  git@github.com:kyletravis/grim-arithmetic.git (fetch)
origin  git@github.com:kyletravis/grim-arithmetic.git (push)
```

## Foundry server clone

If testing from a server-side clone instead of manifest install, normalize the remote there too:

```bash
cd ~/foundrydata/Data/modules/grim-arithmetic
git remote set-url origin git@github.com:kyletravis/grim-arithmetic.git
git fetch origin --tags
git status --short
```

Use the same `npm run check` gate before treating a server checkout as release-ready.
