# Web development

From the repository root:

```sh
nvm install
nvm use
pnpm install
pnpm dev
```

The root `.nvmrc` pins Node 24.13.0. `nvm install` and `nvm use` also find it when run from `apps/web`. pnpm is pinned by the root `packageManager` field.

## Browser smoke tests

Install the Chromium binary once after installing dependencies, and again after updating Playwright:

```sh
pnpm --filter @spectrum/web exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:ui
```

From `apps/web`, the same test commands run directly. Use `pnpm test:e2e:report` there to open the last HTML report.

Playwright uses `http://127.0.0.1:3000`. Locally it reuses an existing Spectrum dev server, or starts and stops one for the run. Keep that port assigned to this app. In CI it always requires its own server. Tests read the repository selected by that server's `SPECTRUM_REPOSITORY`, which defaults to this repository.

The two Chromium smoke tests cover dashboard loading and navigation to Specs and Rules. They deliberately keep assertions broad; parsing and data validation belong to the existing unit tests. There are no screenshot baselines. Failed tests retain a trace and screenshot under `test-results/`, and the HTML report is written to `playwright-report/`.

`pnpm check` runs static checks and unit tests. Browser tests run separately with `pnpm test:e2e`.
