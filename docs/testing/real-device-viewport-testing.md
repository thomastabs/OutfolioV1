# Real Device and Viewport Testing

Story 9563524. Extends the Playwright E2E harness (Story 9563142) with
device-emulated projects so responsive layout is verified against real
device viewports instead of relying on manually resizing a sandbox
browser window.

## What this closes

The sandbox environment used during manual QA can't reliably resize its
browser window to arbitrary device dimensions. `playwright.config.ts` now
runs the suite against three projects instead of one:

| Project        | Device profile              | Engine  | Viewport   |
|----------------|------------------------------|---------|------------|
| `chromium`     | Desktop Chrome                | Chromium | 1280x720  |
| `iPhone 13`    | Playwright's `devices['iPhone 13']`   | WebKit  | 390x664   |
| `iPad Pro 11`  | Playwright's `devices['iPad Pro 11']` | WebKit  | 834x1194  |

`iPhone 13` and `iPad Pro 11` are scoped (via each project's `testMatch`)
to `tests/e2e/responsive-layout.spec.ts` only — the golden-path and smoke
specs keep running on `chromium` alone, so device emulation doesn't
triple the run time of tests that don't care about viewport.

## What `responsive-layout.spec.ts` checks

For each of `/`, `/discover`, `/profile`, `/projects`, and
`/developer/{username}`, per device project:

- A key landmark for that page is visible (e.g. the `Project list` region,
  the public profile's `@username` badge).
- The page does not overflow horizontally
  (`document.documentElement.scrollWidth <= clientWidth`).
- A full-page screenshot is captured to the test's output directory as a
  CI artifact for human visual review.

The `/profile`, `/projects`, and `/developer/{username}` pages need an
authenticated session and a public profile respectively. The test creates
these via direct API calls (`page.request.post/put`, which share the
browser context's cookie jar with `page.goto`) rather than replaying the
full registration UI flow three times per device project.

## Why not pixel-diff baseline snapshots

Playwright's `toHaveScreenshot()` was considered and deliberately not
used for CI-gating:

- The isolated E2E test database resets and reseeds on every run, and
  test fixtures use timestamped usernames/titles — pages like `/profile`
  and `/developer/{username}` render different text every run, which
  would produce false-positive pixel diffs unrelated to any real layout
  regression.
- Baselines are rendering-environment-sensitive and would need to be
  generated on the CI runner itself (not locally), then committed as
  binary files and re-generated on every legitimate UI change — an
  ongoing maintenance cost this suite doesn't take on.

Structural assertions (no overflow, key landmark visible) are the
pass/fail signal; the captured screenshots satisfy the "visual record"
need without gating CI on pixel comparison.

## Running locally

```bash
pnpm exec playwright test tests/e2e/responsive-layout.spec.ts
```

Requires the same local setup as the rest of the E2E suite: a running
app server at `E2E_BASE_URL` (default `http://localhost:3000`) backed by
the isolated test database, seeded via `pnpm seed:test-db`. See the E2E
harness setup for Story 9563142 for the full local prerequisites.

Screenshots land under `test-results/<test name>-<project name>/*.png`.
In CI, the whole `test-results/` and `playwright-report/` trees are
uploaded as the `playwright-report` artifact on every run (pass or fail).
