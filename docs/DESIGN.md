# True Hourly — Design

**Status:** approved for build, v1
**Last updated:** 2026-10-20

---

## 1. The product

**One sentence:** you think you earn `salary ÷ 2080`; True Hourly tells you what you
actually earn per hour worked, once benefits and real hours are counted.

**The reveal.** The app opens with a number the user already believes
(`baseSalary / 2080`). As they add inputs, that number moves — sometimes up a lot
(strong benefits, reasonable hours), sometimes down (60-hour weeks, thin benefits).
The delta is the product.

**It is not a doom tool.** Existing "real hourly wage" calculators are built to make you
feel underpaid. This one is built to be _correct_, which means it frequently reports a
number higher than the naive one. That honesty is the differentiator.

### v1 scope

- One job, evaluated in isolation. (Comparing two offers is v2 — see §8.)
- Single-page, progressive disclosure. Core inputs visible, everything else collapsible.
- Live result, no submit button.
- Inputs autosave to `localStorage`, so a returning visitor picks up where they left off.
  No accounts, no backend, no server.

### Explicitly out of scope for v1

- Comparing two or more offers side by side
- Full tax bracket engine / state tax tables
- Cost-of-living normalization
- Real-time stock quote lookup
- Shareable links / URL-encoded state
- Any persistence beyond `localStorage`

---

## 2. The calculation model

### 2.1 Denominator: hours actually worked

```
weeksOff    = (ptoDays + holidayDays + unpaidLeaveDays) / daysPerWeek
            + sabbaticalWeeks / sabbaticalCycleYears
hoursWorked = hoursPerWeek × (52 − weeksOff)
daysWorked  = (52 − weeksOff) × daysPerWeek
```

`daysPerWeek` defaults to 5. The user can override the computed `hoursWorked` directly with
a slider; when they do, `hours.overridden = true` and the UI says so.

**Why this matters.** PTO is not extra money for a salaried worker — it's the same money for
fewer hours. Putting it in the denominator captures its value exactly once. Putting a "PTO
value" line item in the numerator _and_ dividing by 2080 counts it twice, which is the single
most common error in this category of tool.

**Unlimited PTO** needs no special case in the math. The input is "days you realistically
expect to take," defaulting to 15. What unlimited PTO _does_ change is the separation payout
(§2.6).

> Note on framing: the popular claim that unlimited-PTO employees take meaningfully fewer days
> is not well supported. Namely's own client data showed 13 days (unlimited) vs 15 (accrual) in
> 2018, then reversed post-pandemic to 12.09 vs 11.36 across ~1,000 companies. The app should
> not assert the folk claim. The payout difference, by contrast, is unambiguous.
> Source: https://namely.com/blog/does-your-pto-plan-type-even-really-matter/

**Sabbatical** is a denominator input for the same reason PTO is: a paid sabbatical is the
same salary for a block of weeks not worked. It is amortized over its cycle — 6 weeks every
5 years is 1.2 weeks off every year you stay — and it has **no line item**. An earlier draft
of §2.3 listed it as a `taxable` line item; that was the double-count invariant 2 exists to
prevent, and putting the weeks in the numerator while also dividing by a denominator that
still contained them would have inflated the headline twice over.

Parental leave is the one paid-leave item that stays in the numerator, because the
denominator does **not** remove those weeks and because it is only paid in a year leave is
actually taken (hence `includeParentalLeaveInHeadline`, default false).

**Commute** is collected but excluded from the headline denominator. It appears in a secondary
"hours the job consumes" view, because unpaid commute time is a real cost but folding it into
"hours worked" makes the headline number arguable.

### 2.2 Numerator: three tax buckets

Every line item is `taxable`, `tax_free`, or `tax_deferred`.

```
faceValue        = Σ item.annualValue
salaryEquivalent = Σ grossUp(item)

grossUp(item) =
  item.bucket === 'tax_free'     ? item.annualValue / (1 − t)
: item.bucket === 'tax_deferred' ? item.annualValue / (1 − tDeferred)
:                                  item.annualValue
```

`t` = combined marginal rate (federal income + FICA + state + local), single slider,
default `0.30`, presets at 0.22 / 0.32 / 0.42.

`tDeferred` defaults to `0` (i.e. face value). An advanced toggle can raise it, with a
warning explaining that employer 401(k) contributions escape payroll tax permanently but
are taxed as ordinary income on withdrawal and are illiquid until 59½.

**Why a slider and not a bracket engine.** The purpose of the tax model here is a _unit
conversion_, not a paycheck estimate. Adding $180k of taxable salary to $14k of tax-free
health premium and calling it $194k is a unit error — those dollars don't buy the same
amount of life. One rate fixes the unit mismatch with one input and zero annual maintenance.
A bracket engine would be more precise about a question the app isn't asking.

### 2.3 Line items

| Category   | Item                                              | Bucket       | Default                             |
| ---------- | ------------------------------------------------- | ------------ | ----------------------------------- |
| cash       | Base salary                                       | taxable      | —                                   |
| cash       | Annual bonus (target %)                           | taxable³     | 0                                   |
| cash       | Sign-on bonus, amortized over expected tenure     | taxable⁴     | 0, tenure 4y                        |
| equity     | RSUs (public)                                     | taxable      | 0                                   |
| equity     | RSUs / options (private)                          | taxable      | **$0 headline**, scenarios separate |
| retirement | 401(k) employer match                             | tax_deferred | 0                                   |
| retirement | 401(k) non-elective / profit sharing              | tax_deferred | 0                                   |
| retirement | ESPP discount value                               | taxable      | 0                                   |
| retirement | Student loan repayment match (SECURE 2.0)         | tax_deferred | 0                                   |
| health     | Employer share of medical/dental/vision premium   | tax_free     | 0                                   |
| health     | Employer HSA contribution                         | tax_free     | 0                                   |
| health     | Employer FSA seed                                 | tax_free     | 0                                   |
| perks      | Free meals (`$/day × daysWorked`)                 | tax_free     | $15/day, off                        |
| perks      | Commuter benefit                                  | tax_free     | 0                                   |
| perks      | Tuition / education reimbursement (to §127 limit) | tax_free     | 0                                   |
| perks      | Home office / phone / internet stipend            | taxable¹     | 0                                   |
| perks      | Wellness / gym stipend                            | taxable¹     | 0                                   |
| perks      | Professional development budget                   | tax_free     | 0                                   |
| insurance  | Employer-paid life / AD&D / disability premium    | tax_free²    | 0                                   |
| leave      | Paid parental leave (weeks × weekly rate)         | taxable      | 0                                   |

**Sabbatical is deliberately not in this table.** It is a denominator input (§2.1), not a
line item. **Employer FSA seed is not clamped**: the $3,400 figure in `constants.ts` is the
employee *salary-reduction* limit and does not cap an employer non-elective contribution. No
sourced employer ceiling has been found, and invariant 5 says an unsourced figure is not a
constant to apply, so the seed is taken at face value.

¹ Cash stipends are generally taxable wages; accountable-plan reimbursements may not be.
Default to taxable and let the user flip it, with a tooltip.
² Employer-paid group term life is tax-free only up to $50,000 of coverage; above that the
excess premium is imputed income. v1 treats it as tax_free with a note; v2 can model the split.
³ `bonusTreatment` (`'target' | 'earned'`, default `'target'`) decides the row's **confidence,
never its value**. A target is real money if hit, but whether it is hit depends on performance,
so `'target'` marks the row `estimated` — it renders visually distinct and becomes eligible for
the 10%-of-total estimate warning (§2.5). A user whose bonus is contractual, already declared,
or reliably paid in full selects `'earned'`. Same pattern as footnote 1: the distinction is
real, the app cannot observe it, and the engine does not guess.
⁴ The amortized sign-on is `estimated` whenever `expectedTenureYears > 1`, because spreading a
one-time payment over a predicted tenure makes the per-year figure a projection. It has **no**
treatment flag, unlike footnote 3: a sign-on has already been paid in full, so the uncertainty
is in the divisor rather than in whether the money arrives — and the engine can see the divisor
without asking. At a one-year window the whole bonus lands in one year, which is what actually
happens, so the row is `entered`.

**ESPP** deserves a note: a 15% discount with a 6-month lookback is one of the most
underrated items in tech comp. v1 models the discount value as
`annualContribution × discountRate / (1 − discountRate)` and adds a warning that this ignores
the lookback (which makes it worth more) and holding-period tax treatment.

### 2.4 Equity

Discriminated union on `equity.type`:

**`public`** — `shares × pricePerShare / vestYears`. The user supplies the price;
we link out to a quote rather than calling an API. Warn that year-1 value ≠ steady state
without refreshers, and that a 1-year cliff makes year-1 contingent.

**`private`** — the interesting case. Never show a single confident number.

```
common      = shares × lastPreferredPrice × (1 − commonDiscount)
diluted     = common × (1 − expectedDilution)
perYear     = diluted / vestYears

scenarios = {
  zero:   0,
  modest: perYear,                    // exit at roughly the last round's valuation
  strong: perYear × strongMultiple,
}
expectedValue = showExpectedValue
                  ? perYear × liquidityProbability
                  : 0                              // opt-in enforced in the ENGINE
```

Defaults, all user-adjustable and **labelled as assumptions, not facts**:
`commonDiscount = 0.30`, `expectedDilution = 0.25`, `strongMultiple = 3`.

**`expectedValue` is zeroed by the engine, not hidden by the UI.** It is the shakiest figure
the app can produce, and an opt-in guarded only by a conditional in a component is not an
opt-in. The probability behind it is still reported in `assumptions` while the value is
hidden, so the UI can label the toggle itself ("show expected value at 20%").

**`liquidityProbability` has three sources**, most specific first, and the one used is
reported in `scenarios.liquidityProbabilityBasis` so the UI can say which:

| Basis     | Source                                                    |
| --------- | --------------------------------------------------------- |
| `entered` | the user typed a probability (`0` is a real answer)       |
| `stage`   | observed exit rate for the company's funding stage        |
| `default` | neither given → `0.20`                                    |

The stage table is **sourced, not invented** — the one figure in the private-equity model
that is not purely editorial:

| Stage at grant | Probability of any exit |
| -------------- | ----------------------- |
| Seed           | 13%                     |
| Series A       | 19%                     |
| Series B       | 25%                     |
| Series C       | 33%                     |
| Series D+      | 39%                     |

It rises monotonically because later-stage companies have already survived the filters that
kill earlier ones. Caveats that keep it a default rather than a prediction: it is a secondary
source, the underlying population is not fully specified, and "exit" covers both an
acqui-hire and a tenfold IPO — only one of which makes a grant worth anything.

The `0.20` fallback is deliberately **below** the midpoint of that table, because most
startups fail. Earlier-stage companies carry materially higher risk, and the base rate across
all startups sits nearer the bottom of that table than its middle — so with the stage unknown,
the conservative figure is the defensible one. Overstating the probability makes a worthless
grant look like compensation, which is the error this app exists to correct; understating it
makes the headline a floor, which is the error it can live with.

The headline uses `zero`. The UI shows the range with a plain-language explanation of each
haircut. This is the single most distinctive thing in the app — it is the honest answer to
"what is my startup equity worth," and the honest answer is a range with stated assumptions.

**`options`** — intrinsic value only: `(fmv − strike) × sharesPerYear`. Warn about the
exercise cost (you must pay `strike × shares` to get the shares) and, for ISOs, AMT exposure.
Never show negative intrinsic value as a line item; clamp to 0 and warn "currently underwater."

**`unknown`** — $0, with a warning and a prompt to try the private estimator.

### 2.5 Warnings

The engine emits structured `Warning[]` rather than the UI inferring them. Triggers include:

- equity value unknown or underwater
- `hoursPerWeek > 50` — "the headline treats all these hours as compensated"
- `hoursWorked` manually overridden
- unlimited PTO selected (separation payout note)
- 401(k) match entered but a vesting cliff also entered
- sign-on bonus with a clawback period **longer** than the expected tenure it is amortized
  over — the headline is counting money that could still be repaid
- any `estimated` line item contributing more than 10% of total comp
- a 401(k) match entered alongside a vesting period — the headline counts money
  that is not yet the user's
- nothing entered at all: Fixture C requires a warning on a degenerate input, and
  `$0.00/hr` with no explanation reads as a broken calculator

### 2.6 Off-headline notes

Real but not per-hour, so they render as cards beside the result rather than line items:

- **PTO payout at separation.** Accrual plans carry a balance the employer must pay out;
  unlimited plans are worth $0 at exit. Estimate as `dailyRate × expectedAccruedBalance`.
- **Severance policy**, **on-call burden**, **remote vs in-office** (commute time + cost,
  and the meals/wardrobe difference), **401(k) vesting schedule**, **equity cliff**.

---

## 3. Types

```ts
type TaxBucket = "taxable" | "tax_free" | "tax_deferred";
type Confidence = "entered" | "estimated" | "unknown";
type Category =
  | "cash"
  | "equity"
  | "retirement"
  | "health"
  | "insurance"
  | "leave"
  | "perks";

interface LineItem {
  id: string;
  label: string;
  category: Category;
  bucket: TaxBucket;
  annualValue: number; // whole dollars per year, face value
  salaryEquivalent: number; // after gross-up
  confidence: Confidence;
  note?: string;
}

interface HoursBreakdown {
  hoursPerWeek: number;
  daysPerWeek: number;
  ptoDays: number;
  holidayDays: number;
  unpaidLeaveDays: number;
  sabbaticalWeeksPerYear: number; // sabbaticalWeeks / sabbaticalCycleYears
  hoursWorked: number;
  daysWorked: number;
  overridden: boolean;
}

interface EquityScenarios {
  zero: number;
  modest: number;
  strong: number;
  expectedValue: number; // 0 unless showExpectedValue — see §2.4
  liquidityProbabilityBasis: "entered" | "stage" | "default";
  assumptions: Record<string, number>;
}

type BonusTreatment = "target" | "earned"; // §2.3 note 3
type FundingStage =
  | "seed"
  | "series_a"
  | "series_b"
  | "series_c"
  | "series_d_plus";

interface Warning {
  id: string;
  severity: "info" | "caution";
  message: string;
}

interface Note {
  id: string;
  title: string;
  body: string;
  amount?: number; // dollars; never summed into any total
  confidence: Confidence;
}

interface TrueHourlyResult {
  hours: HoursBreakdown;
  lineItems: LineItem[];
  totals: { faceValue: number; salaryEquivalent: number };
  trueHourly: { faceValue: number; salaryEquivalent: number };
  baseHourlyNaive: number;
  equityScenarios?: EquityScenarios;
  warnings: Warning[];
  notes: Note[]; // off-headline cards (§2.6) — never affect a total
}
```

`notes` is a separate array rather than a `LineItem` with an "off-headline" flag
on purpose. A flag is something a future summing loop can forget to check, and the
first time it does, the headline silently double-counts a one-time asset — the same
class of error invariant 2 exists to prevent.

---

## 4. Golden fixtures

These are hand-computed. They go into `src/engine/__tests__/golden.test.ts` and must pass
exactly (±$0.01 on hourly figures). **Do not change an expected value to make a test pass** —
if the engine disagrees with a fixture, one of them is wrong and it needs a human decision
logged in `DECISIONS.md`.

### Fixture A — "NYC mid-level, public company, 45h weeks"

**Input**

| Field                          | Value                                           |
| ------------------------------ | ----------------------------------------------- |
| baseSalary                     | 180,000                                         |
| bonusPct                       | 0.10 (→ 18,000)                                 |
| hoursPerWeek                   | 45                                              |
| daysPerWeek                    | 5                                               |
| ptoDays                        | 20                                              |
| holidayDays                    | 11                                              |
| 401(k) match                   | 7,200 (4% of base)                              |
| employer health+dental premium | 14,000                                          |
| employer HSA contribution      | 1,000                                           |
| meals                          | $15/day, enabled                                |
| equity                         | public RSU, 100,000 grant / 4 years → 25,000/yr |
| t                              | 0.32                                            |

**Derivation**

```
weeksOff    = (20 + 11) / 5          = 6.2
weeksWorked = 52 − 6.2               = 45.8
hoursWorked = 45 × 45.8              = 2,061
daysWorked  = 45.8 × 5               = 229
meals       = 229 × 15               = 3,435

taxable       = 180,000 + 18,000 + 25,000            = 223,000
tax_free      = 14,000 + 1,000 + 3,435               =  18,435
tax_deferred  = 7,200                                =   7,200

faceValue        = 223,000 + 18,435 + 7,200          = 248,635
salaryEquivalent = 223,000 + (18,435 / 0.68) + 7,200 = 257,310.29

trueHourly.faceValue        = 248,635    / 2,061     = 120.64
trueHourly.salaryEquivalent = 257,310.29 / 2,061     = 124.85
baseHourlyNaive             = 180,000    / 2,080     =  86.54
```

**The story this fixture tells:** the user believed $86.54/hr. The truth is ~$125/hr-equivalent.
Benefits and RSUs are worth more than the extra 5 hours a week cost.

### Fixture B — same package, 60-hour weeks

Only `hoursPerWeek` changes to 60.

```
hoursWorked = 60 × 45.8 = 2,748
trueHourly.faceValue        = 248,635    / 2,748 = 90.48
trueHourly.salaryEquivalent = 257,310.29 / 2,748 = 93.64
baseHourlyNaive                                  = 86.54
```

**The story:** grinding 60 hours erases nearly the entire benefits advantage. Same offer,
same benefits, and the true hourly falls from ~$125 to ~$94.

### Fixture C — degenerate input

`baseSalary = 0`, everything else default. Must not divide by zero, must not produce `NaN`
or `Infinity` anywhere in the result, and must return `trueHourly` of `0` with a warning.

---

## 5. State, autosave, privacy

`CompensationInput` is the single source of truth, held in one `useReducer`. It stays a plain,
serializable object — that's what makes autosave trivial now and compare mode cheap in v2.

**Autosave.** On every input change (debounced ~500ms), write to `localStorage`:

```ts
{ version: 1, input: CompensationInput }
```

On load, read it back through a small hand-written guard:

- wrapped in try/catch (storage can be disabled or throw in private windows)
- if `JSON.parse` fails, the `version` doesn't match the current one, or the object is
  missing required fields → discard it and use defaults
- never crash, never render `NaN`

Bump `version` whenever the shape of `CompensationInput` changes, so a returning visitor with
a stale save gets clean defaults instead of broken math. No validation library — the guard is
~10 lines.

A "reset to defaults" button clears the save.

**Privacy.** Salary data never leaves the browser: no backend, no analytics on input values,
no network calls carrying compensation data. Say so on the page — it's a genuine feature,
not just an implementation detail.

---

## 6. UI

Single page, progressive disclosure, live result.

- **Always visible:** base salary, hours/week, PTO + holidays, 401(k) match, employer health
  premium. Five inputs get you a meaningful number.
- **Collapsible sections:** Equity, Retirement & savings, Health & insurance, Time & leave,
  Perks & stipends, Tax assumption.
- **Result panel** (static on desktop, pinned bottom on mobile¹): the big number, the naive
  anchor struck through above it, a face-value ↔ salary-equivalent toggle, a stacked
  contribution breakdown, warnings, and the off-headline cards.
- Estimated values render visually distinct from entered ones.
- Every input has a plain-language "why this matters" affordance. The explanations _are_ the
  product for a first-time visitor.

¹ Sticky on desktop was specified here and built in session 5, then removed after
using it: the pinned card hangs over the breakdown you are scrolling to read, and
what it is hanging there is the figure you have already looked at. On desktop the
result sits beside the form anyway, which is the job sticky would have done. The
mobile pin stays, because there the two cannot share the screen. See DECISIONS.md,
2026-10-20 session 5 follow-up.

Accessibility is not a phase-6 afterthought: labelled inputs, sliders with text-entry
alternatives, results announced via a live region, keyboard-operable disclosures, and
contrast checked in both themes.

---

## 7. Build sequence

Six Claude Code sessions, each ending green and committable. See `session-prompts.md`.

1. Scaffold, types, constants, purity test
2. Hours + cash + tax gross-up
3. Retirement + health + perks
4. Equity (all four modes) + warnings
5. UI shell, core inputs, live result
6. Full inputs, autosave, polish, a11y pass, deploy

---

## 8. v2 candidates

- **Compare two offers.** The reason `CompensationInput` is a clean serializable object is so
  this becomes `CompensationInput[]` plus a diff view, not a rewrite.
- Shareable links: encode input into the URL fragment (never sent to servers). This is the
  point to add a runtime validation library like Zod, since a pasted URL is untrusted input.
- Cost-of-living normalization between metros
- Full bracket engine as an optional "precise mode"
- A small Cloudflare Worker to proxy stock quotes
- Shareable result images / OG cards
- Content pages for SEO ("what is a true hourly rate", per-benefit explainers)

---

## Sources

- [IRS — 401(k) limit increases to $24,500 for 2026](https://www.irs.gov/node/152316)
- [Venable — 2026 IRS Dollar Limits on Benefits and Contributions](https://www.venable.com/insights/publications/2025/11/2026-irs-dollar-limits-on-benefits-contributions)
- [Benefit Resource — 2026 Plan Limits](https://www.benefitresource.com/resources/plan-limits/)
- [Namely — Does Your PTO Plan Type Even Really Matter?](https://namely.com/blog/does-your-pto-plan-type-even-really-matter/)
- [Zabella — Startup exit statistics](https://www.zabella.net/blog/startup-exit-statistics) —
  exit probability by funding stage (§2.4). Secondary source; the primary dataset is still to
  be tracked down.
- [Clockify — PTO Statistics](https://clockify.me/pto-statistics)
- [Cloudflare — Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
