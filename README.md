# Grim Arithmetic

*Foundry knows how hard the encounter is. Grim Arithmetic tells you who might not walk away.*

Grim Arithmetic is a Foundry VTT module for GM-facing mortality and encounter-risk analysis, beginning with Pathfinder 2e on Foundry VTT v13 Build 351+.

Current status: early MVP development. The module has a tested probability engine, first-pass PF2e actor/Strike extraction, and a GM-only panel opened from a skull button in token controls.

## Documents

- [Product Requirements Document](./PRD.md)
- [Backlog / Roadmap](./BACKLOG.md)
- [MVP Scaffold Implementation Plan](./docs/plans/2026-05-09-mvp-scaffold.md)
- [Installation Guide](./docs/INSTALL.md)
- [Foundry v13 / PF2e Testing Guide](./docs/TESTING.md)

## Initial Direction

- Minimum Foundry target: v13 Build 351
- Initial system target: PF2e
- Later target: Foundry v14 + SF2e support
- First useful feature: selected PC vs selected enemy immediate down-risk analysis
- Permanent death probability: planned future milestone, intentionally not modeled in MVP

## Development

```bash
npm install
npm run check
```

`npm run check` runs:

- ESLint
- Vitest
- Vite build

## Local Build Output

Foundry loads:

```text
dist/grim-arithmetic.js
styles/grim-arithmetic.css
templates/mortality-panel.hbs
```

During early development, `dist/` is committed so a copied module directory is immediately loadable by Foundry.
