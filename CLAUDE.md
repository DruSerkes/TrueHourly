# True Hourly

A free, client-side web app that computes a person's **true hourly rate** from their full
compensation package — not just salary ÷ 2080.

The whole product is one insight: people compare jobs on base salary, but the real number
depends on employer-paid benefits (which are often tax-free) and on hours actually worked
(which PTO reduces). This app makes that number legible.

---

## Non-negotiable invariants

Read these before writing any code. Violating one of them is a bug even if tests pass.

### 1. `src/engine/` never imports React, never touches the DOM, never reads `window`

The engine is a pure function: `calculate(input: CompensationInput): TrueHourlyResult`.
Same input, same output, always. No dates, no randomness, no I/O, no side effects.
There is a test (`src/engine/__tests__/purity.test.ts`) that asserts this by scanning imports —
do not delete or weaken it.

### 2. PTO goes in the denominator, never the numerator

For a salaried worker, paid time off is **not additive compensation** — the salary is the same
whether they take 5 days or 25. Its value shows up as _fewer hours worked for the same money_.

```
hoursWorked = hoursPerWeek x (52 - ptoWeeks - holidayWeeks - unpaidLeaveWeeks)
```

Adding a "PTO value" line item to total comp while also dividing by 2080 double-counts it.
Never do this. If a line item for PTO ever appears in `lineItems`, it is a bug.

The only exception is **PTO payout at separation** for accrual plans, which is a genuine
one-time asset and is handled as an explicitly-labeled, off-headline note — not a line item.

### 3. Every dollar belongs to exactly one tax bucket

```ts
type TaxBucket = "taxable" | "tax_free" | "tax_deferred";
```

| Bucket         | What goes here                                                                                                       | Salary-equivalent treatment |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `taxable`      | Base, bonus, RSU value at vest, taxable perks                                                                        | face value (x1)             |
| `tax_free`     | Employer health/dental/vision premium, employer HSA contribution, free meals, commuter, tuition up to the §127 limit | `value / (1 - t)`           |
| `tax_deferred` | Employer 401(k) match, employer non-elective/profit-sharing                                                          | face value by default       |

`t` is a single user-controlled **combined marginal rate (income + payroll)**, default `0.30`.

**Do not gross up `tax_deferred` the same way as `tax_free`.** A 401(k) match is taxed as
ordinary income on withdrawal and is illiquid until 59½. Treating it as tax-free is wrong
and is the kind of error that discredits the whole tool.

### 4. Two headline numbers, always both computed

- `trueHourly.faceValue` — total comp ÷ hours worked, no tax modelling at all.
- `trueHourly.salaryEquivalent` — after grossing up the `tax_free` bucket.

Plus `baseHourlyNaive = baseSalary / 2080` as the anchor the user came in believing.
The UI leads with face value and reveals salary-equivalent; the engine never decides
which to show.

### 5. Never invent a dollar figure

Every statutory limit, default, and assumption lives in `src/engine/constants.ts` with a
source URL in a comment. If a number is needed and isn't there, add it there with a source —
do not inline a literal in calculation code. If no source can be found, make it a
**user-adjustable input with a labelled default**, not a hardcoded fact.

### 6. Estimates are labelled as estimates

Every `LineItem` carries `confidence: 'entered' | 'estimated' | 'unknown'`. Anything the
user did not type is `estimated` and must render visually distinct in the UI. Unknown
private-company equity defaults to **$0 in the headline** with scenarios shown separately.
The app never presents a guess as a fact.

### 7. No salary data leaves the browser

No backend, no analytics on input values, no network calls carrying compensation data.
Shareable state is encoded into the URL **fragment** (`#s=...`), which browsers do not send
to servers. `localStorage` is wrapped in try/catch and the app works without it.

---

## Stack

- **Vite + React 19 + TypeScript** (strict). SPA, no router needed for v1.
- **Vitest** for unit tests. The engine target is meaningful coverage of every line-item path.
- **Tailwind** for styling.
- Deployed to **Cloudflare Pages**: build `npm run build`, output `dist`.

No state library. `useReducer` over a single `CompensationInput` is sufficient and keeps the
input object trivially serializable — which is the whole point of the URL-state design.

## Layout

```
src/
  engine/           pure calculation — no React, no DOM
    types.ts        CompensationInput, TrueHourlyResult, LineItem, Warning
    constants.ts    2026 IRS limits + defaults, each with a source URL
    hours.ts        denominator
    cash.ts         base, bonus, sign-on amortization
    equity.ts       public RSU, private scenarios, options
    retirement.ts   401(k) match, ESPP, profit sharing
    health.ts       premiums, HSA, FSA
    perks.ts        meals, commuter, stipends, tuition, leave
    tax.ts          bucket gross-up
    calculate.ts    orchestrator — the only public export
    __tests__/
  state/
    reducer.ts
  ui/
docs/
  DESIGN.md         product + calculation model (read this before session work)
  DECISIONS.md      append-only log — every session adds to it
```

## Conventions

- Money is stored as **whole dollars per year** (`number`) throughout the engine. Format at
  the render boundary only, never inside calculations.
- Rates are decimals (`0.04`), never percentages (`4`). Suffix any percentage-shaped UI value
  `Pct` so the conversion point is obvious.
- Named exports only. No default exports outside `App.tsx`.
- Prefer a discriminated union over optional fields for anything with modes
  (equity type, PTO plan type).
- Every new line item must: appear in `LineItem[]`, carry a `bucket`, carry a `confidence`,
  and have at least one test asserting its contribution to both totals.

## Working agreement for Claude Code sessions

1. **Read `docs/DESIGN.md` first.** It has the full calculation model and the golden fixtures.
2. State the plan and the files you will touch before writing code.
3. One session = one green, committable state. `npm run typecheck && npm run test && npm run build`
   must all pass before you finish.
4. **Append a dated entry to `docs/DECISIONS.md`** describing any judgment call you made that
   a future session would otherwise have to re-derive. This is not optional — it is how the
   next session gets context.
5. Do not add features outside the session's stated scope, even obvious ones. Note them in
   `DECISIONS.md` under "deferred" instead.
