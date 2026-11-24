# Tests

These scripts drive the real game in a headless browser, and simulate whole runs for balance numbers. They are tools for development. The game does not need them to run.

## What you need

- The game's own install: `npm install`.
- Playwright with Chromium, available to Node (`npm install -g playwright` and `npx playwright install chromium`, or any setup where `require('playwright')` works). It is not listed in `package.json`, so a plain `npm install` stays small.

## Browser tests

Start the dev server first, then run a test against its port:

```
npm run dev -- --port 5173 --strictPort
PORT=5173 node tests/run.cjs 7
```

- `tests/lib.cjs` holds the shared helpers: open the game, read its state, walk a path, play a fight.
- `tests/run.cjs <seed>` plays one whole run and fights everything. It ends with an `END` line and `errors: []` when all is well. It exits with a failure code if the page logged an error.
- Other `tests/*.cjs` files each check one area. Each prints `PASS` or `FAIL` lines and exits with a failure code if any check failed.

To run every test file in a row:

```
for f in tests/*.cjs; do case $f in tests/lib.cjs|tests/run.cjs|tests/*-common.cjs) continue;; esac; echo "== $f"; PORT=5173 node $f | tail -1; done
```

The tests use the handle that the game exposes in dev mode only: `window.keepfall` is the game and `window.keepfallSfx` is the sound object.

Do not edit source files while a browser test is running. The dev server reloads the page on every change and that breaks the test.

## Balance simulator

```
npm run sim
```

`tests/sim/runsim.ts` plays 3000 runs per line with the real battle rules and prints win rates. It has no map: it assumes about half of the hidden enemies are met. The target bands for a first run with no shop upgrades are in `HANDOFF.md`.
