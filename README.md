# True Hourly

A free, client-side web app that computes your **true hourly rate** from a whole compensation
package — not just salary ÷ 2080.

The product is one insight: people compare job offers on base salary, but the real number depends
on employer-paid benefits (which are often tax-free, and appear on no payslip) and on the hours
actually worked (which paid time off reduces). A $180,000 offer with good benefits and 45-hour
weeks pays about **$125/hour-equivalent**; the same package at 60-hour weeks pays about **$94**.

No account, no backend, no analytics. Nothing you type leaves your browser.

## Local setup

Requires Node 22+ (`.nvmrc` pins the version) and **pnpm** — the build-script approvals in
`pnpm-workspace.yaml` are a pnpm feature and npm ignores them.

```sh
corepack enable          # once, to get the pinned pnpm from package.json
pnpm install
pnpm dev                 # http://localhost:5173
```

| Script           | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Vite dev server with HMR                               |
| `pnpm build`     | Typecheck, then production build into `dist/`           |
| `pnpm preview`   | Serve the built `dist/` locally                         |
| `pnpm test`      | Vitest, single run                                      |
| `pnpm test:watch`| Vitest in watch mode                                    |
| `pnpm typecheck` | `tsc -b --noEmit`                                       |
| `pnpm lint`      | ESLint, then a Prettier format check                    |
| `pnpm format`    | Prettier write                                          |
| `pnpm deploy`    | Build and push to Cloudflare Pages (see below)           |

All four of `typecheck`, `test`, `lint` and `build` must pass before a change is committed.

## Deploying (Cloudflare Pages)

| Setting            | Value           |
| ------------------ | --------------- |
| Framework preset   | None / Vite     |
| Build command      | `npm run build` |
| Output directory   | `dist`          |
| Node version       | 22              |
| Environment vars   | none            |

There are no secrets, no API keys and no environment variables — the app has no backend to hold
credentials for. If a deploy ever starts asking for one, something has gone wrong with the
architecture rather than with the deploy.

**From the CLI**, once per machine:

```sh
pnpm dlx wrangler login          # interactive, opens a browser
pnpm deploy                      # builds, then wrangler pages deploy dist
```

**Or connect the Git repository** in the Cloudflare dashboard and use the table above. The build
command is written as `npm run build` there because that is what the Pages build image runs by
default; it does the same thing as `pnpm build`.

## Architecture

The split that matters is **engine / UI**, and it is enforced rather than conventional.

```
src/
  engine/     pure calculation. No React, no DOM, no clock, no I/O.
  state/      one useReducer over one CompensationInput, plus localStorage autosave.
  ui/         React components. All formatting and rounding happens here.
docs/
  DESIGN.md       the calculation model, the golden fixtures, the UI spec
  DECISIONS.md    append-only log of judgment calls, newest last
```

**`src/engine/` is a pure function**: `calculate(input: CompensationInput): TrueHourlyResult`. Same
input, same output, always. `src/engine/__tests__/purity.test.ts` scans every engine file's imports
and fails if one of them reaches for React, the DOM, `window`, or the clock — which is what makes
the golden fixtures in `docs/DESIGN.md` §4 meaningful as tests rather than as snapshots.

Three consequences worth knowing before changing anything:

- **Money is whole dollars per year, and rates are decimals** (`0.04`, never `4`), throughout the
  engine. Formatting happens only in `src/ui/format.ts`. Rounding early is how a total stops
  matching the sum of its rows.
- **Paid time off is in the denominator, never the numerator.** A salaried person earns the same
  whether they take five days or twenty-five; the value of PTO is fewer hours for that same money.
  A "PTO value" line item would double-count it, and is a bug by definition.
- **Every dollar belongs to exactly one tax bucket** — `taxable`, `tax_free`, or `tax_deferred` —
  and `tax_deferred` is deliberately *not* grossed up like `tax_free`. A 401(k) match is taxed on
  withdrawal and illiquid until 59½; treating it as tax-free is the error that would discredit the
  whole tool.

`CLAUDE.md` has the full set of invariants. `docs/DECISIONS.md` has the reasoning behind anything
that looks arbitrary — read the entry before changing the thing it describes.

## Status

v1. The engine covers every line item in DESIGN.md §2, the UI covers all of its inputs, and the
state is a single serializable object — which is what makes the queued v2 work (comparing two
offers, shareable URL-fragment links) a feature rather than a rewrite. See DESIGN.md §8.
