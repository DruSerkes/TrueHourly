# Decisions

Append-only. Newest entries at the bottom. Every session adds one.

Each entry records judgment calls a future session would otherwise have to
re-derive — not a changelog of what was written. If the reasoning is obvious from
the code, it doesn't belong here.

---

## 2026-09-29 — Session 1: scaffold, types, constants, purity test

**Scope:** Vite + React 19 + TS strict toolchain, the directory layout from
CLAUDE.md, and exactly three engine files (`types.ts`, `constants.ts`,
`__tests__/purity.test.ts`) plus a stubbed `calculate.ts`. No calculation logic,
no UI, no state.

### Type-shape judgment calls

**`ptoDays` lives in a discriminated union, not on `HoursInput` directly.**
CLAUDE.md invariant 2 writes the denominator in weeks; DESIGN.md §2.1 and the
`HoursBreakdown` type write it in days ÷ `daysPerWeek`. Same arithmetic — followed
DESIGN.md, since `HoursBreakdown` is specified verbatim and uses days.

The union is `PtoPlan = { type: 'accrual'; ptoDays; expectedAccruedBalanceDays } |
{ type: 'unlimited'; expectedDaysTaken }`. The reason is semantic, not
mathematical: under an accrual plan the number is *days granted*; under unlimited
it is *days the user expects to take*. One field named `ptoDays` holding both
would silently invite the folk claim that unlimited-PTO employees take fewer days
— which DESIGN.md §2.1 explicitly says the app must not assert. The denominator
math is identical either way; only the separation-payout note differs, and
`expectedAccruedBalanceDays` exists solely to feed it.

**`equity` is a five-variant union including `'none'`.** DESIGN.md §2.4 names four
modes (`public`, `private`, `options`, `unknown`), but `unknown` means "the user
has equity and can't value it" and carries a warning plus a nudge to the private
estimator. Someone with no equity at all is a different state and shouldn't see
that warning. `'none'` is that state, and it makes `equity` non-optional, which
keeps `CompensationInput` free of optional fields.

**`CompensationInput` has no optional fields.** Every field is required, with
absence modelled as `null` (`hoursWorkedOverride`, `retirement.espp`) or as a
union variant (`equity.type: 'none'`). This is what makes the `localStorage`
version guard in DESIGN.md §5 a ten-line hand-written check rather than a
schema: "missing required field → discard the save" is only a usable rule if
every field is required. It also makes v2's `CompensationInput[]` diff total.

**`exactOptionalPropertyTypes` is on**, beyond the strictness the session brief
asked for. Cheap here because of the decision above — the only optional
properties in the whole engine are `LineItem.note` and
`TrueHourlyResult.equityScenarios`, both genuinely absent-or-present. Turn it off
later if it fights the reducer; nothing depends on it.

**Two fields exist to hold back money the headline shouldn't claim.**
`leave.includeParentalLeaveInHeadline` (default false) and
`privateEquity.showExpectedValue` (default false). Parental leave is only
realized in a year leave is taken, and private-equity expected value is the
product of four assumptions. Both are real, both would inflate a per-hour rate
that reads as a fact, so both are opt-in and default to an off-headline note.

**`EquityScenarios.assumptions` is `Record<string, number>` — verbatim from
DESIGN.md §3, and looser than the rest of the file.** Kept as specified; the keys
match `PrivateEquity` field names by convention. Tighten to a keyed type if the
UI ever needs to enumerate them.

**`insurance` is its own input group** even though DESIGN.md's line-item table
lists one `insurance` category row. Employer-paid life/AD&D and disability are
separately negotiated and separately valued, and `lifeCoverageAmount` is a
coverage figure (a death benefit) rather than a premium — mixing it into
`HealthInput` would break the "every money field is dollars per year" rule.

### Constants

`constants.ts` is split into two labelled sections — `§ 2026 statutory limits`
(facts, each with a source URL) and `§ App defaults` (assumptions, every one
marked `ASSUMPTION`). A wrong value in the first section is a factual error; a
wrong value in the second is an editorial judgment. Future sessions should not
cite anything from the second section.

`LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE` ($5,250) and
`LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE` ($50,000) carry
`TODO: verify 2026 figure against a primary IRS source`. Both are long-standing
statutory figures, but neither was confirmed for 2026 against a primary source in
this session. Do not remove the TODOs without a citation.

`WEEKS_PER_YEAR = 52` and `LIMIT_COMMUTER_ANNUAL` were added beyond the brief's
list. The first prevents a bare `52` appearing in `hours.ts` next session; the
second is derived from the monthly figure and marked as such, not independently
sourced.

`DEFAULT_UNLIMITED_PTO_EXPECTED_DAYS` is deliberately equal to
`DEFAULT_PTO_DAYS` (both 15). A lower default would encode the unsupported folk
claim about unlimited PTO. This equality is intentional — don't "fix" it.

### Purity test

Scans recursively, so a future `src/engine/equity/` subdirectory is covered
without anyone updating a list. Two mechanics worth knowing before touching it:

- **Comments and strings are stripped in two separate passes, and the order
  matters.** Identifier scanning runs on code with *both* removed (a `Date`
  inside a doc comment is prose). Import scanning runs on code with *only
  comments* removed, because a module specifier lives inside a string literal.
  The first draft stripped both before scanning imports, which made the React
  check match nothing and pass vacuously. The self-test at the bottom of the file
  caught it; those cases are there to keep it caught.
- **A vacuous-pass guard** asserts `files.length > 0`, because an empty scan is
  the way this test would quietly stop doing anything.

Checks beyond the brief's list — `sessionStorage`, `performance.now`,
`navigator`, `process.env`, `import.meta.env`, `crypto.randomUUID`, `console.*`
— are the same class of impurity, so they're treated the same way. `console` is
included because logging is a side effect and the engine's channel for telling
the user something is a `Warning`, not stdout.

Verified by temporarily adding a file importing React and calling `Date.now()`
and `window.innerWidth`; all three were caught, with the offending filename in
the test title. An ESLint rule (`no-restricted-globals` / `no-restricted-imports`
scoped to `src/engine/**`) duplicates part of this for editor-time feedback. The
test is the load-bearing check; the lint rule is convenience.

### Deferred

- **`src/engine/hours.ts`, `cash.ts`, `equity.ts`, `retirement.ts`, `health.ts`,
  `perks.ts`, `tax.ts` were not created.** CLAUDE.md's Layout lists them, but
  empty placeholder modules would be dead files the purity test scans and future
  sessions have to fill anyway. Sessions 2-4 create them as they're implemented.
- **`src/state/` and `src/ui/` exist as empty directories** (`.gitkeep` only).
- **A minimal app shell was created outside the stated scope**: `index.html`,
  `src/main.tsx`, `src/App.tsx` (a one-line placeholder, the only sanctioned
  default export), `src/index.css` (the Tailwind import). `npm run build` cannot
  pass without an entry point, and a build that doesn't exercise React + Tailwind
  proves nothing about the toolchain. No inputs, no state, no result panel.
- **`calculate.ts` returns a zero-filled result** rather than a partial
  computation, so nothing downstream can mistake a stub for an answer. It emits
  one `engine-not-implemented` warning and computes `baseHourlyNaive` honestly
  (it depends on nothing else). Remove the warning in session 2.
- **Golden fixtures (DESIGN.md §4) not written.** They belong with the code they
  test: Fixtures A and B need the hours + cash + tax paths (session 2) and the
  public-RSU path (session 4). Fixture C — no `NaN`, no `Infinity`, `trueHourly`
  of 0 with a warning — is satisfiable now and should go in at the start of
  session 2, before the real math, so it constrains the implementation rather
  than ratifying it.
- **Prettier ignores `*.md`.** `DESIGN.md` is hand-formatted (aligned tables, box
  characters) and reformatting it would produce noise that buries real edits.
- **Vitest runs in the `node` environment** with no jsdom dependency installed.
  Component tests in sessions 5-6 will need `jsdom` plus
  `@testing-library/react`, opted into per-file with a
  `// @vitest-environment jsdom` pragma so engine tests stay fast.

---

## 2026-10-04 — Session 2: hours + cash + tax gross-up

**Scope:** `hours.ts`, `cash.ts`, `tax.ts`, wired into `calculate.ts`; golden
fixtures A/B/C with the hours-and-cash assertions enabled and the rest skipped;
focused edge-case tests. No equity, retirement, health, insurance, perks, leave,
or UI.

**Fixtures:** no disagreement. Every enabled assertion from DESIGN.md §4 passes
as written — 2,061 hours and 229 days for A, 2,748 for B, $86.54 naive, $198,000
of cash, and all of Fixture C. Nothing was edited in DESIGN.md.

### Hours

**The override sets `hoursWorked` but not `daysWorked`.** When
`hoursWorkedOverride` is non-null, `daysWorked` stays derived from PTO and
holidays. The override is a statement about hours; `daysWorked` prices per-day
perks (free meals, DESIGN.md §2.3), and there is no defensible way to infer a
day count from an hours slider. A user on 45-hour weeks who overrides to 2,000
hours has not said anything about how many days they show up. Session 3 depends
on this when it prices meals — if it ever looks wrong, the fix is a separate
`daysWorkedOverride` input, not inferring one from hours.

**`hoursWorkedOverride: 0` is an override, not an absence.** `null` means
derive. Conflating them would make the UI say "derived" while showing the user's
own number. This is why the field is `number | null` rather than defaulting to 0.

**`daysPerWeek` is clamped to `[1, 7]`.** A 0 makes `weeksOff` infinite, and the
guard has to live in the engine rather than relying on the UI: input also
arrives from a restored `localStorage` save (DESIGN.md §5) and, in v2, from a
URL fragment.

**Negative and non-finite inputs are laundered to 0, not rejected.** Added
`src/engine/numbers.ts` (`finite`, `clamp`, `nonNegative`, `dollars`) for this.
It is not in CLAUDE.md's Layout — a deliberate addition, because the alternative
was the same four guards duplicated in every contributor module. The engine's
contract is that it always returns a finite result (Fixture C), and a
half-filled form must still produce a number. Validation that *rejects* belongs
to `src/state/`.

**`hours.ts` emits no warnings.** It reports what it computed; `calculate.ts`
decides what is worth saying about it. This keeps a warning from ever
contradicting the number rendered beside it, since `hoursWarnings` reads the
computed `HoursBreakdown` rather than the raw input.

### Cash

**Added `LineItemDraft = Omit<LineItem, 'salaryEquivalent'>` to `types.ts`.**
Contributor modules know their face value, bucket, and confidence, but not the
tax assumption. Without the draft type, every module would have to write a
placeholder `salaryEquivalent` that is wrong until `tax.ts` overwrites it — and
a field that is wrong in the interim is a field someone eventually reads.
`applyGrossUp` is now the only function in the engine that writes a
`salaryEquivalent`. Sessions 3-4 should return drafts for the same reason.

**All cash items are `confidence: 'entered'`.** The rule being applied:
`confidence` tracks whether the *engine* invented the number, not whether the
user typed into that exact box. Every cash figure is arithmetic over input
fields. Session 3 will need `estimated` for anything priced off an app default
(meals at $15/day being the first).

**Zero-value bonus and sign-on rows are omitted; base salary at $0 is not.** A
breakdown full of zero rows hides the rows that matter, but the base row is the
anchor and a list that reshuffles while you type is worse than a $0 row. Totals
are identical either way — this is purely about what the UI renders.

**`expectedTenureYears` floors at 1 for the sign-on amortization.** A 0 would
divide by zero. One year attributes the whole bonus to year one, which is what
actually happened.

**Face values round to whole dollars (`dollars()`); salary-equivalents do not.**
CLAUDE.md stores money as whole dollars, but `LineItem.salaryEquivalent` is
documented as possibly fractional and Fixture A's $257,310.29 depends on the
unrounded quotient.

### Tax

**`MAX_TAX_RATE = 0.6`** added to `constants.ts` as an assumption, with the
reasoning in the comment: `value / (1 - t)` explodes as `t` approaches 1 and
*inverts* above it, so an unclamped 1.3 turns a $14,000 health premium into
-$33,333. 0.60 sits above the highest plausible US combined marginal rate, so
the clamp cannot truncate a real answer.

**A clamped rate always warns.** `tax-rate-clamped` / `deferred-rate-clamped`.
The user typed a number and the engine used a different one; invariant 6 says
that can never be silent.

**`WARN_HOURS_PER_WEEK_THRESHOLD = 50`** also moved into `constants.ts` rather
than sitting as a literal in `calculate.ts` — invariant 5's habit, applied to a
threshold rather than a dollar figure.

### Resolved — the sign-on clawback warning was backwards in DESIGN.md

DESIGN.md §2.5 originally listed the trigger as "sign-on bonus with a clawback
period **shorter** than the amortization window". Implemented literally at
first, then flagged: that condition describes the benign case. A clawback that
expires before the amortization window closes means the money goes
unconditional early, and the only consequence is that the amortized figure is
conservative.

The risk is the opposite shape — a clawback still in force at the point the user
expects to leave — because then the headline is counting dollars they may have
to repay. **Decided to flip it** (user, 2026-10-04):

- condition is now `signOnClawbackMonths > expectedTenureYears × 12`
- severity raised from `info` to `caution`
- warning id renamed `sign-on-clawback-shorter-than-amortization` →
  `sign-on-clawback-outlasts-tenure`
- **DESIGN.md §2.5 was edited to match**, with its `Last updated` bumped to
  2026-10-04. The design doc is authoritative, so the fix belongs there and not
  only in code — a future session reading §2.5 must not re-derive the old
  condition.

Equality (`clawback === tenure × 12`) is deliberately silent: the clawback
expires exactly as the user walks out, so nothing is at risk. Boundary covered
by a test.

### Deferred

- **`equity.ts`, `retirement.ts`, `health.ts`, `perks.ts` still not created.**
  Unchanged from session 1: sessions 3-4 create them on arrival.
- **Fixtures A and B are partly skipped.** The whole-package totals ($248,635 /
  $257,310.29 / $120.64 / $124.85 / $90.48 / $93.64) and the bucket-composition
  block are in `describe.skip` with the enabling session named in the block
  title. The fixture *inputs* are already complete — including the 401(k) match,
  health premium, HSA, meals, and the public RSU grant — so enabling a block is
  deleting `.skip` and nothing else.
- **DESIGN.md §4's RSU grant is expressed as "100,000 grant / 4 years".** Modelled
  in the fixture as 1,000 shares at $100 over 4 years, since `PublicEquity` holds
  shares and a price, not a dollar total. Same $25,000/yr.
- **The `engine-partial` warning replaces `engine-not-implemented`.** It names
  the six categories that still contribute nothing, so a partially-implemented
  engine cannot be mistaken for a finished one. Narrow it in session 3 and remove
  it in session 4.
- **Off-headline notes (DESIGN.md §2.6) are not modelled.** The PTO separation
  payout needs `expectedAccruedBalanceDays × dailyRate`, and `dailyRate` is a
  cash-and-hours derivation that exists now — but §2.6 notes are a result-shape
  question (`TrueHourlyResult` has no field for them) and that belongs with the
  UI sessions. `unlimited-pto-no-payout` is emitted as a warning in the meantime.
- **`commuteMinutesOneWay` is collected and unused.** DESIGN.md §2.1 keeps it out
  of the headline denominator deliberately; the "hours the job consumes" view is
  a session 5-6 concern.
- **`src/engine/__tests__/_input.ts`** holds a default `CompensationInput` for
  tests. It mirrors `constants.ts` rather than hardcoding values, so a changed
  default fails a test instead of silently diverging. `src/state/` owns the real
  defaults from session 5; when it exists, this file should delegate to it.

---

## 2026-10-04 — Session 3: retirement + health + perks

### Scope

`retirement.ts`, `health.ts`, `perks.ts` created and wired into `calculate.ts`.
Every non-equity line item in DESIGN.md §2.3 now contributes. Equity is still
absent, so `engine-partial` remains — narrowed to name equity alone.

### Fixtures

**No disagreement.** With benefits landed, Fixture A matches DESIGN.md §4
exactly: `tax_free` 18,435 (14,000 premium + 1,000 HSA + 3,435 meals),
`tax_deferred` 7,200, meals 3,435 at 229 days × $15. Face value 223,635 and
salary-equivalent 232,310.294… are each exactly $25,000 below §4's totals —
the RSU line, to the cent. Nothing in DESIGN.md was edited.

Enabled: the `bucket composition` block, plus a new `whole package except
equity` block. That block's two figures are **not new hand-computed values** —
they are §4's own totals less the $25,000 RSU line. Since the RSU line is
`taxable`, it contributes the same $25,000 to both totals, so the subtraction is
exact rather than approximate. It is the strongest available falsification
before session 4 (twelve line items against an independently derived sum), and
it becomes the `whole package` block when equity lands.

Still skipped (6 tests): A's $120.64 / $124.85 and B's $90.48 / $93.64, all of
which need the RSU line.

### Three type changes the brief required

1. **`RetirementInput.employerMatch: number` → `EmployerMatch` union.** The
   brief asks for "a flat dollar amount or a percent-of-base with an optional
   cap" — two shapes with different fields, which CLAUDE.md's conventions say is
   a discriminated union, not optional fields. The cap is `capDollars: number |
   null`, where `null` is *uncapped* and `0` is a real cap of zero; reading a
   missing cap as 0 would silently delete a real match. Same `null`-vs-`0`
   distinction as `hoursWorkedOverride`.
2. **`PerksInput.commuterBenefit` → `commuterBenefitMonthly`.** The brief says
   "monthly × 12, clamped to the monthly limit × 12", and §132(f) is a monthly
   exclusion stated per month. Clamping monthly then annualizing matches both
   the statute's unit and how plans are written.
3. **`LeaveInput.sabbaticalWeeklyRate: number | null` added.**
   _Superseded later the same session — see "Resolved" below: the field was
   removed entirely when sabbatical moved to the denominator._ The brief's
   formula is `(sabbaticalWeeks × weeklyRate) / cycleYears` and no such field
   existed. `null` derives it from `baseSalary / 52` — the common case, since a
   paid sabbatical normally pays full salary — and a derived rate is reported as
   `confidence: 'estimated'` per invariant 6. An explicit number models a
   part-paid sabbatical, which a derived-only design could not express.

### Shared shape: `ContributionSet`

The new modules return `{ items, warnings }` rather than a bare draft array.
Several items need a statutory clamp, and a clamped value must not be applied
silently (invariant 6). Returning the warnings from where the clamp happened
means it is detected once; a second pass to re-derive "was this clamped?" could
disagree with the first. `cash.ts` still returns a plain array — it has no
clamps, and changing it would be churn.

### Retirement

- **§415(c) is applied to employer contributions only, and scaled
  proportionally.** When match + profit sharing + student loan match exceed
  `LIMIT_DEFINED_CONTRIBUTION_TOTAL`, all three are scaled by the same factor.
  Any priority order (match first, profit sharing second) would be an invented
  plan rule and would make the result depend on field order. Two honest
  limitations, both stated in the warning text: the real §415(c) limit also
  counts the employee's own elective deferrals, which the engine never asks for
  (they are the user's money, not compensation, and §2.3 lists no such line
  item), so actual headroom is smaller; and rounding to whole dollars after
  scaling can leave the sum a dollar or two off the limit.
- **ESPP uses `contribution × d / (1 − d)`, not `contribution × d`.** $10,000 of
  payroll buys $11,765 of stock at a 15% discount, so the gain on money
  contributed is 17.6%, not 15%. The divisor converts "discount off the market
  price" into "gain on what you put in", which is the figure comparable to a
  salary. `MAX_ESPP_DISCOUNT = 0.5` added to `constants.ts` as a guard (not a
  plan fact) because `1 − d` reaches zero at d = 1 and inverts above it; §423
  caps a qualified plan at 0.15, so the ceiling cannot truncate a real plan.
- **ESPP is `taxable`, the other three are `tax_deferred`.** The ESPP gain lands
  in a brokerage account; the rest land in a 401(k). Invariant 3.

### Health and insurance

- **Insurance lives in `health.ts`.** CLAUDE.md's layout has no `insurance.ts`
  and the brief puts the premiums there. The items still carry
  `category: 'insurance'` so the breakdown groups them as DESIGN.md §2.3 does.
- **The HSA clamp is generous and says so.** The statutory limit is combined
  employee + employer, and the engine only knows the employer side, so clamping
  the employer contribution to the full limit leaves no room for the user's own.
  The warning states this rather than the engine pretending to know the split.
- **FSA: the brief's clamp is applied as written, and it is worth a second
  look.** _Superseded — the clamp was removed; see "Resolved" below._
  `LIMIT_HEALTH_FSA` ($3,400) is the *employee salary-reduction* limit;
  an employer seed is generally not subject to it (an employer non-elective
  contribution can exceed it, subject to separate rules). The brief said to
  clamp to the FSA limit, so that is what is implemented, but a seed between
  $3,400 and the real ceiling is currently under-counted. **Flagged for a
  decision** — see "Open question" below.
- **Group term life is treated as entirely tax-free with a note**, per §2.3
  note 2. When `lifeCoverageAmount` exceeds the $50,000 ceiling the note admits
  the direction of the error ("slightly generous") rather than staying silent.
  No warning: the brief scoped warnings to clamps, and nothing is clamped here.

### Perks and leave

- **Meals use `hours.daysWorked`, never a flat 250.** This is the pairing that
  keeps invariant 2 honest: PTO reduces the denominator *and* the value of a
  per-day perk, and a flat day count would credit the user for lunches on days
  they were on holiday. A test asserts that more PTO lowers the meals line.
- **Stipends default to `taxable`** and flip to `tax_free` only via
  `stipendTaxTreatment` (§2.3 note 1). The engine never guesses which it is; the
  note explains the flip in both directions.
- **Parental leave stays off the headline by default** (`includeParentalLeave
  InHeadline`, already in the types). It is only paid in a year leave is taken,
  so annualizing it would overstate every other year.
- **Sabbatical is amortized over its cycle** — 6 weeks every 5 years is 1.2
  weeks every year you stay. _Superseded: it shipped as a `taxable` line item
  per §2.3 and was moved to the denominator later the same session. See
  "Resolved" below. The amortization itself survived the move; only which side
  of the division it lands on changed._
- **Zero rows are omitted** for everything here, matching `cash.ts`. Only base
  salary survives at $0, as the anchor row.

### Resolved — both open questions, decided by the user on 2026-10-12

**1. The employer FSA seed is no longer clamped.** No sourced ceiling on an
employer non-elective FSA contribution could be found. `LIMIT_HEALTH_FSA`
($3,400) is the employee *salary-reduction* limit and does not cap an employer
seed, so clamping against it was under-counting a real benefit. Invariant 5
settles it: an unsourced figure is not a constant to apply. The seed is now taken
at face value, the `fsa-seed-clamped` warning is gone, and the test asserts the
absence of the clamp rather than its presence. `LIMIT_HEALTH_FSA` stays in
`constants.ts` — it is correctly sourced, it is simply not this limit — with a
comment saying what it is not. If an employer ceiling is ever sourced, clamp here
the way the HSA contribution is clamped.

**2. Sabbatical moved to the denominator, and DESIGN.md was corrected.** A paid
sabbatical is the same salary for weeks not worked, which is the definition of a
denominator input (invariant 2). §2.3 listing it as a `taxable` line item was the
double-count the invariant exists to prevent. What changed:

- `HoursInput` gains `sabbaticalWeeks` and `sabbaticalCycleYears`; `LeaveInput`
  loses both, and loses `sabbaticalWeeklyRate` entirely — a weekly pay rate is
  only needed to value a numerator line item, and there is no longer one. This
  also removes the `null`-derives-from-base-salary behaviour added earlier in
  this session and the `estimated` confidence that went with it.
- `HoursBreakdown` gains `sabbaticalWeeksPerYear` (= weeks / cycle), so the
  denominator stays fully auditable — the user can see the 1.2 weeks that moved.
- `weeksOff` in `hours.ts` adds the amortized figure. A cycle of 0 contributes 0
  rather than dividing by zero, and the existing floor keeps `hoursWorked` from
  going negative on an absurd input.
- `perks.ts` loses the sabbatical block, and with it its `baseSalary` dependency
  — `PerksContext` is now just perks, leave, and hours.
- **DESIGN.md edited**: §2.1 formula and a new paragraph explaining why
  sabbatical is a denominator input and parental leave is not; the §2.3 table row
  deleted with a note saying the omission is deliberate; `HoursBreakdown` in §3
  updated; `Last updated` bumped to 2026-10-12.
- Tests moved from `perks.test.ts` to `hours.test.ts`, where the sweep now
  asserts no line item mentions `sabbatical` either. One of them pins the actual
  point: adding a sabbatical *raises* `trueHourly` while leaving `totals`
  untouched, which is what "same money, fewer hours" means numerically.

The parental-leave treatment is unchanged and is the contrast that makes the rule
legible: the denominator does not remove parental-leave weeks, and the benefit is
only paid in a year leave is taken, so it stays in the numerator behind an opt-in
flag.

### Deferred

- **`equity.ts` is still the only missing module.** Session 4 adds all four
  modes, enables the last 6 skipped fixture assertions, and removes
  `engine-partial`.
- **`matchVestingYears` is collected and unused.** DESIGN.md §2.5 lists "401(k)
  match entered but a vesting cliff also entered" as a warning trigger; the
  brief scoped warnings to clamps only, so it lands with session 4's warnings
  work.
- **`EsppInput.hasLookback` only changes the note's wording**, not the value.
  Modelling the lookback properly needs a price path the engine does not have;
  §2.3 is explicit that v1 undercounts here and says so.
- **`insurance.lifeCoverageAmount` is used only for the note.** Splitting the
  premium at the $50,000 ceiling is a v2 job per §2.3 note 2.
- **Off-headline notes (§2.6) are still unmodelled**, unchanged from session 2.
