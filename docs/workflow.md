# Project workflow

This document describes the intended branch, CI, and release workflow for
maintainers of `dash-cli`.

## Branch model

The project uses a two-branch integration model:

- `develop` is the active development branch.
- `main` is the release branch.

Create feature and fix branches from `develop`, then open pull requests back
into `develop`. Squash-merge those pull requests once CI is green.

When `develop` is ready to release, open a release pull request from `develop`
to `main`. Merge release PRs with a merge commit so the release boundary remains
visible in history.

This repository now has both `main` and `develop`. Keep `develop` as the
default development target for feature and fix work. If the GitHub default
branch still points at `main`, update that repository setting before enforcing
branch rules.

## CI

CI lives in `.github/workflows/ci.yml`.

It runs on:

- every pull request
- pushes to `develop`
- pushes to `main`
- manual `workflow_dispatch` runs

For code changes, CI runs:

```sh
npm ci
npm run build
npm test
npm run test:coverage
npm pack --dry-run
npm run test:e2e
```

`npm pack --dry-run` is part of CI because tests may live beside source files.
It verifies that `.npmignore` continues to exclude test-only files and CI-only
files from published packages.

`npm run test:e2e` builds a Docker image from the repository and exercises the
installed `dash-cli` binary against an isolated `$HOME`. The e2e suite focuses
on command-line routes that do not launch the TUI, including shortcut CRUD,
direct trigger execution, setup, and uninstall behavior.

CI reads the Node.js version from `.nvmrc`. Keep that file pinned to an exact
version so npm lockfile behavior does not drift as new Node patch releases ship.

## Tests

Vitest is configured in `vitest.config.mjs` for tests under `src/**/*.test.ts`
and `src/**/*.test.tsx`.

The initial test suite has been added, so `npm test`, `npm run test:coverage`,
and `npm run test:watch` should fail when no tests are found. Do not reintroduce
Vitest's `--passWithNoTests` flag unless there is a deliberate, documented
reason.

Coverage should include all source files under `src/**/*.{ts,tsx}`, not only
files imported by tests. Keep test files and local test helpers such as
`src/test/**` excluded from coverage.

## End-to-end tests

Run Docker e2e tests locally with:

```sh
npm run test:e2e
```

The Docker flow uses the Node.js version pinned in the e2e Dockerfile, builds
`dist/index.js`, links the package binary, and verifies the real `dash-cli`
entrypoint. It sets `HOME=/tmp/dash-home` inside the container so config files,
shortcuts, history, debug logs, shell profile edits, and `last-command` writes
cannot touch the host machine.

The e2e suite intentionally avoids full TUI navigation. TUI behavior is covered
primarily by Ink component tests, while Docker e2e covers CLI command behavior
and the shell-facing side effects that are difficult to validate with unit
tests alone.

## Docs-only changes

CI should always start, even for documentation-only changes. Workflow-level path
filters can leave required checks pending on GitHub, so the workflow performs an
internal changed-file check instead.

When every changed file is Markdown (`*.md`), CI exits successfully without
running the test commands. If any non-Markdown file changed, the full checks run.

## CI security

The CI workflow should stay conservative:

- use `npm ci`, not `npm install`
- commit `package-lock.json`
- use `permissions: contents: read` by default
- do not use `pull_request_target` for test workflows
- pin GitHub Actions to full commit SHAs

When updating pinned actions, resolve the release tag to its commit SHA and
update the comment beside the `uses:` line.

## Release process

Release publishing is not automated yet. The target release flow is:

1. Prepare a release PR from `develop` to `main`.
2. Include the version bump and release notes in that PR.
3. Wait for CI to pass.
4. Merge the PR into `main` with a merge commit.
5. Create an annotated tag such as `v1.0.1`.
6. Publish to npm from a dedicated release workflow.

The preferred publishing model is npm trusted publishing with GitHub Actions
OIDC, not a long-lived `NPM_TOKEN`. Configure the trusted publisher in npm
before adding an automated publish workflow.

Release workflows should run on GitHub-hosted runners and should avoid package
manager caching during publish jobs.
