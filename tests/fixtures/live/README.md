Drop JSON produced by `game.modules.get('grim-arithmetic').api.exportLiveFixture()` here
(one file per token, e.g. `pc-fighter-l6.json`, `npc-ogre.json`). Optionally add an
`"expect": { "disposition": "pc", "minAttacks": 1, "attackBonusAtLeast": 10 }` block.
`tests/live-fixtures.test.ts` runs the adapter over every file.
