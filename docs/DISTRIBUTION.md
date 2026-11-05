# Releasing

## Prepare a version

1. Update `package.json` and the lockfile with `npm version <version> --no-git-tag-version`.
2. Add `docs/releases/<version>.md` and update the changelog. Update versioned manual-install URLs in the README and configuration reference.
3. Run `npm run build:card`. Regenerate screenshots with `npm run docs:screenshots` if the interface changed.
4. Run `npm test`, `npm run test:browser`, `npm run check:dist`, and `npm run check:release -- --tag v<version>`.
5. Commit the source, documentation, and generated files. Confirm that the GitHub Checks and HACS workflows pass.

`npm run release:assets` creates a local artifact set under `.release/`, containing the JavaScript file, source map, license, release notes, and SHA-256 checksums.

## Create a release

Push a tag matching the package version, such as `v0.3.0`. The **Draft release** workflow runs the checks and attaches the verified JavaScript file, source map, and checksums to a draft GitHub release.

Before publishing, test installation and upgrading through HACS. Check resource registration, configuration preservation, temperature controls, preset persistence, and schedule saving. Review the draft's notes and assets, then publish it on GitHub.

## HACS packaging

The GitHub repository name is `trvzb-control-card`. The root `hacs.json` selects `trvzb-control-card.js`, built under `dist/`. Repository settings should enable issues and provide a description and relevant topics, such as `home-assistant`, `hacs`, `lovelace`, `sonoff`, `trvzb`, and `zigbee2mqtt`.

The HACS workflow validates the repository as a Dashboard card (`plugin`). Inclusion in HACS's default catalog requires a separate submission.

See the official [Dashboard requirements](https://www.hacs.xyz/docs/publish/plugin/), [repository requirements](https://www.hacs.xyz/docs/publish/start/), and [validation action](https://www.hacs.xyz/docs/publish/action/).
