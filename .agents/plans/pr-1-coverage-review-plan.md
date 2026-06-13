# PR 1 Coverage Review Plan

## Context

PR #1 adds the first real Vitest coverage for `dash-cli` and targets the new workflow from `docs/workflow.md`:

- `develop` is the active development branch.
- `main` is the release branch.
- Feature work targets `develop`.
- CI runs build, tests, coverage, and `npm pack --dry-run`.
- Tests live beside source files as `src/foo.test.ts` or `src/foo.test.tsx`.
- `--passWithNoTests` should be removed once real tests exist.

Current PR:

- PR: https://github.com/rmorse/dash-cli/pull/1
- Base: `develop`
- Head: `test-cache-and-components`
- Main commit: `dae593e Add Vitest coverage for core modules and components`
- Latest known reported coverage:
  - Statements: `82.78%`
  - Lines: `83.9%`
  - Functions: `89.38%`
  - Branches: `69.74%`
- Note: reviewer 2 identified that this report is optimistic because unimported source files are omitted until coverage is configured to include all `src/**/*.{ts,tsx}` files.

## Original Plan

1. Establish the documented workflow branch model.
   - Create `develop` from `main`.
   - Push `develop` to origin.
   - Create a feature branch from `develop`.
   - Open a draft PR back into `develop`.

2. Add unit tests using the source-adjacent pattern.
   - For `src/cache.ts`, add `src/cache.test.ts`.
   - Follow the same pattern for other high-value modules where practical.
   - Keep file-backed tests isolated from the real user home directory.

3. Check and improve coverage.
   - Run `npm run test:coverage`.
   - Aim for over 80% coverage within reason.
   - Remove `--passWithNoTests` once tests exist.

4. Cover components with appropriate tests.
   - Prefer the existing project style and avoid unnecessary dependencies.
   - Use a local Ink stream test harness unless a package is clearly needed.
   - Verify keyboard-driven behavior without overfitting tests to implementation details.

5. Verify the CI-equivalent suite.
   - `npm test`
   - `npm run test:coverage`
   - `npm run build`
   - `npm pack --dry-run`

6. Commit and publish the work.
   - Commit with a clear descriptive message.
   - Push the feature branch.
   - Create the draft PR targeting `develop`.

## Reviewer Amendments

The first two reviews found no blocking issues in the shipped behavior, but identified several test and workflow improvements worth triaging before marking the PR ready.

### Deferred For Now

1. Strengthen `ShortcutsEditor` move/delete test.
   - Current risk: the test calls `onUpdate` after move but does not re-render with the reordered list.
   - This can make the delete assertion pass for the wrong reason.
   - Fix by re-rendering with the moved shortcut list before testing delete, or by directly asserting the mocked `removeShortcut` call arguments.
   - Reviewer 2 added that the `moveShortcut` mock ignores the supplied id; a stronger version should assert `moveShortcut("one", 1)` and the exact resulting order.
   - Deferred because the current reviewer verdict is non-blocking and CI is green; keep tracked for the next test-hardening pass.

2. Strengthen `TextInput` submit test.
   - Current risk: the test verifies `onSubmit("")`, which reflects stale controlled props.
   - Fix with a small stateful wrapper so typed input updates the controlled value before submit.
   - Assert that submit receives the typed value.
   - Deferred because typing is already covered and the current gap is test precision rather than product behavior.

### Fix Before Ready

1. Fix `SettingsScreen` test isolation around clear history.
   - Current risk: `Settings.test.tsx` triggers clear history through `Settings.tsx`, which imports and calls the real `clearHistory()`.
   - That writes to the real `~/.dash-cli/history.json` during `npm test`.
   - Fix by mocking `../history.js` in the component test or injecting the clear-history side effect so the component test cannot mutate local Dash state.

2. Configure coverage to include unimported source files.
   - Current risk: `vitest.config.mjs` excludes files from coverage but does not force all source files into the report.
   - Unimported files such as `src/components/App.tsx`, `src/setup.ts`, and top-level `src/index.tsx` are omitted from the percentage.
   - Add a coverage include/all-source setting for `src/**/*.{ts,tsx}`, while excluding tests and `src/test`.
   - Re-run coverage and either restore the over-80% target with additional tests or report the true lower baseline honestly.

3. Update `docs/workflow.md`.
   - Remove or revise the note that says tests still use `--passWithNoTests`.
   - Remove or revise the note that says the repository only has `main`.
   - State that `develop` now exists and should be the default development target.

4. Reduce the most brittle settings navigation tests if practical.
   - Hard-coded long arrow counts tied to `SETTING_FIELDS` are fragile.
   - Prefer helper functions that navigate to a visible label, or at least centralize the count in a named helper.
   - Do not overbuild a testing DSL for this PR.

### Good Follow-Up Targets

1. Add focused coverage for `src/components/App.tsx`.
   - It is the largest untested user-facing surface.
   - Cover tab switching, cached project rendering, shortcut/recent sections, drill-down navigation, and selection behavior.

2. Add tests for `src/setup.ts`.
   - Setup and uninstall modify shell profile files and are high user impact.
   - Use temp profile paths and environment overrides where available.

3. Add tests for `src/index.tsx`.
   - Cover entry routing for `--`, `--setup`, `--uninstall`, trigger args, and default TUI launch boundaries.

4. Improve CLI branch coverage.
   - Cover usage errors, not-found errors, trigger collisions, invalid trigger flags, and JSON error output.

5. Update repository settings so `develop` is the default day-to-day branch.
   - GitHub still reports `main` as the default branch.
   - This is outside the PR code changes but should be aligned with `docs/workflow.md`.

6. Add coverage thresholds later.
   - Wait until the next coverage-focused PR so branch coverage is less fragile.
   - Avoid locking in today's `69.74%` branch coverage too early.

## Next Steps For PR #1

1. Apply the before-ready fixes while keeping the deferred items tracked for a later hardening pass.
2. Run:
   - `npm test`
   - `npm run test:coverage`
   - `npm run build`
   - `npm pack --dry-run`
3. Commit the review fixes onto `test-cache-and-components`.
4. Push the branch and allow CI to rerun.
5. Mark PR #1 ready for review once CI is green.
6. Squash-merge PR #1 into `develop` after review approval.

## Ethos Checks

- Keep changes conservative and scoped to the PR's purpose.
- Prefer clear tests over broad snapshots.
- Avoid adding dependencies unless they materially improve correctness or maintainability.
- Keep package output clean: no tests, harness files, coverage output, or CI-only files in the tarball.
- Keep workflow documentation synchronized with repository reality.
- Do not add coverage thresholds until they are stable enough to be useful rather than noisy.
