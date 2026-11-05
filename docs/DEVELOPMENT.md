# Development

Use Node.js 22 or newer; CI uses Node.js 24. Browser testing and documentation screenshots are self-contained development dependencies.

```sh
npm ci
npx playwright install chromium
npm run build:card
npm test
npm run test:browser
npm run check:dist
npm run check:release
```

On Linux, use `npx playwright install --with-deps chromium` to install Chromium and its system dependencies.

## Source layout

- `src/card.js`: Home Assistant lifecycle, actions, and editor coordination.
- `src/card.html` and `src/card.css`: production markup and themed styles.
- `src/target-temperature.js`: coalesced target changes with immediate UI feedback.
- `src/ui/renderers.js`: schedule rows and dialogs.
- `src/time.js`: HA time preferences and canonical 24-hour input.
- `src/presets.js`: UI identifiers compatible with HTTP origins.
- `src/schedule.js`: schedule validation, conversion, and timezone lookup.
- `src/localize.js` and `src/locales/`: English and Russian catalogs.
- `scripts/build-card.mjs`: esbuild bundle and linked source map.
- `tests/`: unit tests and an isolated browser regression scenario.

Do not edit generated distribution files. Run `npm run build:card` and commit both files under `dist/` after source changes. `npm run check:dist` recompiles in memory and fails if either committed file is stale. Code, comments, documentation, and commits use English. Add user-facing text to both locale catalogs; preserve user-entered names.

`prototype/` is an exploratory interface separate from production. Rebuilding it with `npm run build` additionally requires Python 3.

## Tests

`npm test` checks schedule round trips, overlaps and transition limits, timezone lookup, localization and plurals, every minute's 12/24-hour conversion, and identifiers without secure-context APIs.

`npm run test:browser` intercepts a fabricated HTTP origin. It covers header details events, preset persistence, clock preferences, editing focus, invalid drafts, compact English/Russian layouts at 320/430/1280 px, rapid target changes with delayed confirmations, Auto timer command order, Manual cancellation, Resume, timer expiry, and failure rollback. No credentials, network-connected valve, or real HA installation are used.

## README screenshots

```sh
npm run docs:screenshots
```

This uses the production bundle and synthetic data to regenerate `docs/images/`. Material Design icon paths from the Apache-2.0-licensed `@mdi/js` development dependency stand in for HA's `ha-icon` element. No icon library is added to the production bundle: the installed card uses HA's own icons.

## Continuous integration

- **Checks:** clean dependency installation, unit tests, distribution consistency, local release checks, and Chromium regressions. Artifacts contain the verified distribution.
- **HACS:** official remote repository validation for category `plugin`, without posting PR comments. Requires GitHub repository metadata and network access; it cannot run against an unpublished local checkout.
- **Draft release:** a matching version tag runs Checks and then uploads those checked assets, source map, and SHA-256 checksums to a draft. Publishing the draft is a separate maintainer action.

`npm run check:release -- --tag v0.3.0` checks that a prospective tag matches the package and release notes. `npm run release:assets` produces a local reviewable directory under `.release/`; it does not tag, push, or publish anything.
