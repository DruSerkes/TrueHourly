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

---

## 2026-10-12 — Session 4: equity + warnings + off-headline notes

**Scope.** `equity.ts` (all four modes plus `none`), `warnings.ts`, `notes.ts`,
the `notes` array on `TrueHourlyResult`, and the full golden fixtures. The
engine is now feature-complete against DESIGN.md §2. No UI, no price lookup, no
network call.

### Fixtures: enabled, not adjusted

All six previously-skipped assertions now pass, including both hourly figures to
the cent in Fixtures A and B. **No expected value in `golden.test.ts` was
edited, and the engine agreed with DESIGN.md §4 on the first run** — the only
test that failed was Fixture C, and it failed for a real reason (below). The
`whole package except equity` block from session 3 was deleted rather than kept:
it existed to pin twelve line items against §4's totals *minus* the RSU line,
and the `whole package` block it was standing in for now asserts the undiminished
figures. Keeping both would mean maintaining two statements of the same fact.

Added alongside them: the `taxable` bucket total ($223,000), which could not be
asserted before equity, and a direct assertion on the RSU line ($25,000).

### `no-compensation-entered` — a gap the fixtures caught

Fixture C requires a degenerate input to return `trueHourly` of 0 "with a
warning". Through sessions 2 and 3 that was satisfied **by accident**:
`engine-partial` fired on every result, including an empty one. Removing it
exposed a result with zero warnings, and the fixture failed.

The fix is the warning the case deserved all along. An empty form is the app's
first-load state, and `$0.00/hr` with no explanation reads as a broken
calculator rather than an unanswered question. Note what it deliberately is
**not**: a `no-hours-worked` warning. The denominator on a default input is a
perfectly good 1,872 hours — it is the numerator that is empty, and conflating
the two would send the user to the wrong input. Added to DESIGN.md §2.5.

This is the clearest return the golden fixtures have paid so far: a requirement
written down independently of the code caught a regression introduced by
*deleting* something, which no amount of testing the new feature would have
found.

### `warnings.ts` — catalogue here, triggers where the facts are

The split matters and is not the obvious one. **Every warning id, severity and
message is constructed in `warnings.ts`.** But detection stays in the module
that can see the condition, and the warning travels back through
`ContributionSet`.

Why not move the triggers too:

- A statutory clamp is only observable inside the module that clamped. Re-deriving
  "did the §415(c) limit bind?" in a second pass is exactly the duplication
  `ContributionSet` was introduced to avoid in session 3, and the second pass can
  disagree with the first.
- It would make `warnings.ts` import `retirement.ts` while `retirement.ts` imports
  `warnings.ts`. ESM tolerates that cycle; it should not have to.

So the module exports ~20 single-warning factories plus three aggregators:
`inputWarnings` (everything derivable from the input and the denominator),
`taxWarnings` (moved here from `tax.ts`, which keeps `clampRate` and the
arithmetic), and `compositionWarnings` (judged only after the totals exist).
`calculate.ts` is now a list of spreads with no warning prose in it at all.

`match-vesting-cliff` is the trigger this reorganization was needed for.
DESIGN.md §2.5 asked for it in session 3 and the brief scoped warnings to clamps,
so `matchVestingYears` sat collected and unused. It fires from `retirement.ts`,
which is the only place that knows the match resolved to a non-zero figure — a 0%
match with a five-year schedule is not worth a warning.

### The 10%-estimated rule is implemented and currently dormant

DESIGN.md §2.5 asks for a warning on "any `estimated` line item contributing more
than 10% of total comp". It is implemented in `compositionWarnings` and unit-tested
against synthetic line items, because **no engine line item carries
`confidence: 'estimated'` today** — every value is either entered by the user or
$0 with `unknown`. (The PTO payout *note* is estimated, but a note is not a line
item.) `warnings.test.ts` asserts that premise directly, so the first estimated
line item a later session adds inherits a working warning rather than a silent
one, and the dormancy cannot go unnoticed.

Two design points inside it: the threshold is **strictly greater than** 10%, so
the threshold itself is not a warning; and several offenders collapse into **one**
warning naming them all, because duplicate ids in a list the UI renders by key is
a bug waiting to happen.

### Equity

**`public`.** `shares × price / vestYears`, `taxable`, `entered`. The honesty
problem here is not the number — a share price is observable — it is the *shape*,
so both grant-shape warnings fire: `equity-initial-grant-not-steady-state` always,
and `equity-cliff-contingent` when there is a cliff. They are shared by all three
grant-shaped modes rather than written three times.

**`private`.** The headline row is **$0 with `confidence: 'unknown'`**, and the
value lives in `equityScenarios` beside it. The row is emitted rather than omitted
so the breakdown shows that equity exists and is being counted at zero, instead of
looking as though the user forgot to enter it.

`privateEquityScenarios` follows §2.4 exactly: common discount, then dilution,
then annualize. All four assumptions are clamped to `[0, 1]` (multiples to
non-negative) and echoed back in `scenarios.assumptions` with `vestYears`, so the
UI can show its work without reaching into the input. The clamp is not pedantry: a
`commonDiscount` above 1 flips the sign and turns a worthless grant into a
positive number, which is the one failure mode that would make this module
actively misleading rather than merely uncertain.

**`options`.** Intrinsic value only, floored at 0 — an underwater option is worth
$0 today, never a liability, and a negative row would imply the user owes
something. `options-exercise-cost` fires on **every** options grant, not just
underwater ones, because `strike × shares` is real money the holder must find and
the line item ignores it. `iso-amt-exposure` fires only for ISOs.

**`unknown`.** $0, `confidence: 'unknown'`, and a warning that calls the headline
a floor and points at the private estimator.

**`none`.** Nothing: no row, no warning, no scenario panel.

What equity deliberately does **not** do: discount for time, walk a vesting
schedule month by month, or price an option with Black-Scholes. The first needs a
clock (invariant 1 forbids it) and the last needs a volatility assumption with no
source (invariant 5 forbids it). The per-year figure is a flat
`grantValue / vestYears`, and the cliff and steady-state warnings exist precisely
because that flatness is a simplification the user should see.

`vestYears` is floored at `MIN_VEST_YEARS = 1`, mirroring `MIN_TENURE_YEARS` in
`cash.ts`: `grantValue / 0` is `Infinity`, which Fixture C forbids anywhere in the
result, and attributing the whole grant to year one is what actually happens when
a grant vests immediately.

### Off-headline notes (§2.6)

A new `notes: Note[]` on `TrueHourlyResult`, in `notes.ts`. Shape mirrors
`Warning`: stable id, user-facing prose, plus an optional `amount` and a
`confidence`.

**A separate array, not a `LineItem` with a flag.** A flag is something a future
summing loop can forget to check, and the first time it does, the headline
silently double-counts a one-time asset — the same class of error invariant 2
exists to prevent. `notes.test.ts` pins it directly: adding a 15-day accrued
balance worth over $10,000 must leave all four headline figures byte-identical.

The one note with a figure is the PTO separation payout, and its divisor was a
real decision. The daily rate is `baseSalary / (daysPerWeek × 52)` — **scheduled**
days, about 260 — not `daysWorked`. Payroll computes a payout against the days the
contract pays for, which includes the PTO and holidays themselves; dividing by
days actually worked would inflate the rate by exactly the time off, and the
balance being valued is denominated in those same scheduled days. It is
`estimated`, not `entered`: the user gave a balance they *expect* to hold, and the
rate is the app's own derivation.

Three cards — severance, on-call, remote-vs-in-office — are **unconditional**.
That is deliberate: §2.6 lists them as cards precisely because the app cannot
price them without inventing figures (invariant 5), and a card that only appeared
once the user had thought to enter something would never prompt anybody. They
carry `confidence: 'unknown'` and no `amount`. The remote card quantifies the
commute when one was entered, which is the one place `commuteMinutesOneWay`
finally gets used.

### Deferred

- **`EquityScenarios.expectedValue` is computed unconditionally**, while
  `PrivateEquity.showExpectedValue` is still only a display flag. That is the
  right split — the engine reports, the UI decides — but it means session 5 must
  actually honour the flag. §2.4 says expected value is shown "only when the user
  opts in".
- **No line item is `estimated` yet**, so the 10%-of-total warning is dormant. See
  above.
- **`EsppInput.hasLookback`, `insurance.lifeCoverageAmount`** — unchanged from
  session 3; both affect wording only, both documented in §2.3.
- **`PRIVATE_EQUITY_ASSUMPTION_DEFAULTS`** is exported from `equity.ts` for
  `src/state/` to seed a new input from in session 5. It duplicates
  `PRIVATE_EQUITY_DEFAULTS` in `__tests__/_input.ts`, which is a test fixture and
  deliberately separate — the test file mirrors `constants.ts` so a changed default
  shows up as a failing test rather than a silently divergent fixture.
- **Still zero commits in the repo.** Four sessions of green work, uncommitted.

---

## 2026-10-20 — Session 4 follow-up: the three flags, decided

All three open flags from the session-4 summary, resolved by the user. Commits
are handled by the user per session and are no longer tracked as an open item
here.

### 1. The bonus is a user choice, not a hardcoded confidence

The flag asked whether the annual bonus row should be `estimated` rather than
`entered`. The answer was neither-as-stated: **add an input and let the user
decide.** `CashInput.bonusTreatment: 'target' | 'earned'`, defaulting to
`'target'`.

This is the better answer and it has a precedent in the codebase.
`PerksInput.stipendTaxTreatment` already does exactly this for a stipend that
may be wages or may be an accountable-plan reimbursement: the distinction is
real, the app cannot observe it, so the user flips a flag and the engine does
not guess. Hardcoding `estimated` would have been the app asserting something
about every user's bonus plan that it cannot know. The rule being followed is
not "a bonus is an estimate" — it is **"the engine does not guess"**, and a
fixed value either way violates it.

What `bonusTreatment` changes: the row's `confidence`, and the `(target)` suffix
on its label. What it never changes: `annualValue`, which is
`baseSalary × bonusTargetPct` in both cases, and the `taxable` bucket. Tests
assert the two valuations are identical so the field cannot drift into affecting
the arithmetic.

Consequence worth noting: **this makes the 10%-of-total estimate warning live.**
It was dormant in the session-4 entry above because no line item was ever
`estimated`. A default-`'target'` bonus is, so `warnings.test.ts` lost its
"confirms no engine line item is estimated yet" premise test and gained an
integration block through `calculate` — a 20% target fires the warning (17% of
the package), a 10% target does not (9%), and an `'earned'` bonus of any size
never does.

Fixture A is unaffected in value and now exercises the threshold usefully: its
10% target is `estimated` at 7.2% of the package, so the row renders as an
estimate without an interruption. That assertion replaced the now-false comment
claiming "every figure here was entered".

**Still open: the sign-on bonus has the same problem.** _Superseded — decided
the same day; see "Sign-on bonus" below._ `signOnItem` divides a one-time
payment by `expectedTenureYears` — the user's guess about the future — and the
resulting row is marked `entered`. It was raised in the session-4 summary and
the decision covered the bonus only, so it is deliberately unchanged.

### 2. `showExpectedValue` is now enforced in the engine

`privateEquityScenarios` returns `expectedValue: 0` unless
`PrivateEquity.showExpectedValue` is set. DESIGN.md §2.4 said the figure is shown
"only when the user opts in", and leaving that to UI code that does not exist
yet meant the opt-in was guarded by a conditional nobody had written. One
forgotten `if` in session 5 or 6 would have put the shakiest number in the app
on screen unrequested, which is precisely what invariant 6 exists to prevent.

The cost of enforcing it is nil: `calculate` is pure and sub-millisecond, and the
app already recalculates on every keystroke, so a UI toggle produces the number
instantly.

`assumptions.liquidityProbability` is still reported while the value is hidden —
the UI needs the figure to label the toggle itself ("show expected value at
20%"). Hiding a result must not hide the assumption behind it.

### 3. Liquidity probability is now sourced and stage-aware

`DEFAULT_LIQUIDITY_PROBABILITY` was 0.30, described in `constants.ts` as "the
shakiest one in the file". It is now a three-tier resolution with an actual
source behind the middle tier.

**`LIQUIDITY_PROBABILITY_BY_STAGE`** — seed 13%, Series A 19%, Series B 25%,
Series C 33%, Series D+ 39% — from a study of startup exit outcomes by funding
stage (https://www.zabella.net/blog/startup-exit-statistics, added to DESIGN.md's
source list). Monotonic because later-stage companies have already survived the
filters that kill earlier ones. A test asserts that monotonicity directly, so a
transcription error that inverted two rows would fail rather than quietly
mis-value a package.

Where it lives and why that was a judgment call: these sit in the **App
defaults** section, not under "2026 statutory limits", even though they are
sourced. The statutory block is explicitly facts-with-a-citation that change
annually; these are a secondary source summarizing an empirical distribution
whose population is not fully specified, and "exit" is doing real work in it — an
acqui-hire and a tenfold IPO are both exits and only one makes a grant worth
anything. So: better-grounded than a round number, not a prediction about any
particular company. Annotated as such, with a `TODO` to find the primary dataset.

**Resolution order** (`resolveLiquidityProbability`, exported and tested
directly), most specific first:

1. a probability the user typed — they know their company better than a table
2. the stage table, when a stage is set
3. `DEFAULT_LIQUIDITY_PROBABILITY`, now **0.20**

Two type changes this required. `PrivateEquity.liquidityProbability` became
`number | null`, following the `hoursWorkedOverride` / `EmployerMatch.capDollars`
convention where `null` means "derive" — necessary here because **`0` is a real
answer**: "this will never exit" is a legitimate thing for a user to say, and a
non-nullable number would make it indistinguishable from "not specified". And
`PrivateEquity.stage: FundingStage | null` was added, with `series_d_plus` as a
bucket rather than a round because the observed rate flattens past Series D and
splitting it further would imply precision the source does not support.

`EquityScenarios` gained **`liquidityProbabilityBasis: 'entered' | 'stage' |
'default'`**. Without it the UI would present a user's own guess, a sourced
figure, and a fallback as though they were one kind of claim. With it the UI can
say "19%, the observed rate for Series A companies" — which is invariant 6
applied to an assumption rather than to a dollar figure.

**Why 0.20 and not the table's midpoint (25%).** Because **most startups fail.**
Earlier-stage companies carry materially higher risk, and the base rate across
all startups sits nearer the bottom of that table than its middle, so with the
stage unknown the conservative figure is the defensible one. 0.20 sits between
the seed and Series B figures: wrong in a knowable direction rather than
flattering by default.

The asymmetry of the two errors is the point. Overstating the probability makes a
worthless grant look like compensation — the exact error this app exists to
correct. Understating it makes the headline a floor, which is an error the app
can live with and already tells the user about elsewhere (`equity-unknown` says
so in as many words).

A test pins the fallback below the Series C rate and above seed, so a future edit
cannot drift it upward unnoticed.

_Correction, same day: an earlier draft of this paragraph justified 0.20 by
guessing that users who skip the stage question are more likely to be at
early-stage companies. That was my inference, not the reasoning behind the
decision, and it is a weaker argument — it rests on an unevidenced claim about
user behaviour rather than on startup survival rates. The figure is unchanged;
the justification above is the real one._

`PRIVATE_EQUITY_ASSUMPTION_DEFAULTS` seeds `liquidityProbability: null` and
`stage: null` rather than the fallback figure — an untouched form has made no
claim, and seeding a number would make it look like a user who had chosen 20%.
`esppDiscount` was removed from the test fixture's equivalent bundle, where it
never belonged: it is not a private-equity assumption, and its presence meant the
bundle could not be spread cleanly into a `PrivateEquity`.

### 4. The three unconditional note cards stay, for now

Severance, on-call and remote-vs-in-office still render on every result,
including an empty one. Confirmed as-is on the grounds that it is a layout
judgment best made with a layout in front of you.

**Revisit in session 5**, once the result panel exists. The engine needs no
change either way — `notes` is just data and the UI already decides whether and
when to render each card. The option to weigh first is collapsing all three into
a single "Questions worth asking" card: same content, one box instead of three,
and much less noise beside an empty $0 result on first load.

### Gates

`typecheck`, `lint`, `build` clean. 505 tests passing, none skipped — up from 478,
with the additions in `cash.test.ts` (bonus treatment), `equity.test.ts`
(opt-in enforcement and all three probability tiers) and `warnings.test.ts`
(the estimate warning, now reachable through `calculate`).

### 5. Sign-on bonus — `estimated` when amortized, and no treatment flag

Decided immediately after the above, closing the item it left open.

`signOnItem` now returns `confidence: 'estimated'` whenever
`expectedTenureYears > 1`, and `'entered'` at a one-year window. Spreading a
one-time payment over a predicted tenure makes the per-year figure a projection,
and a projection is an estimate — so the row renders visually distinct and is
eligible for the 10%-of-total warning, exactly like a bonus target.

**Why no `signOnTreatment` flag, when the bonus got one.** The two uncertainties
are different in kind, and the difference decides the design:

- A **bonus target** may never be paid at all. Whether it gets paid depends on
  company and individual performance, and only the user has any idea how likely
  that is. The engine cannot see it, so it asks.
- A **sign-on** has already been paid, in full, in cash. Nothing about the money
  is uncertain. What is uncertain is purely the arithmetic of spreading it, and
  that is visible in the input: if `expectedTenureYears` is 4, the per-year
  figure is a projection; if it is 1, the whole bonus is attributed to year one,
  which is simply what happened.

Adding a flag would have meant asking the user to confirm something the engine
can already read off the divisor. The rule stays "the engine does not guess" —
and here it does not have to, because there is nothing to guess.

At the `MIN_TENURE_YEARS` floor the row is `entered`: a tenure of 0 is laundered
to 1, and a bonus counted against a single year is a fact rather than a
prediction. A test pins that boundary from both sides so the floor and the
confidence rule cannot drift apart.

`warnings.test.ts` gained a second route to the estimate warning from a different
kind of estimate: a $100,000 sign-on over four years is $25,000/yr of a $205,000
package (12%) and fires it; the same $100,000 over one year does not, because
there is no projection in it.

Unchanged: the value, the `taxable` bucket, and the clawback warning, which asks
a separate question (whether the clawback outlasts the tenure) and is unaffected
by how the row's confidence is labelled.

**Gates after this change:** typecheck, lint, build clean; **512 tests passing**,
none skipped.

---

## 2026-10-20 — Session 5: state, the core six inputs, and the live result

The engine was untouched this session, as the brief required. Everything below is
`src/state/` and `src/ui/`.

### 1. The reducer patches groups and replaces unions

`CompensationInput` is nine groups of flat fields plus three discriminated unions
(`equity`, `hours.ptoPlan`, `retirement.employerMatch`). Those two shapes want
different actions, so they got different ones:

- a flat group takes `patchCash` / `patchHours` / … with a `Partial` of that group;
- a union is **replaced whole** — `setEquity`, `setPtoPlan`, `setEmployerMatch`.

Patching a union is how you end up with `{ type: 'unlimited', ptoDays: 20 }`: a value
whose fields contradict its own tag, which typechecks at the call site and is
meaningless everywhere else. The caller builds a complete member and hands it over.
`ptoDaysOf` / `withPtoDays` / `matchAmountOf` are the readers and writers that keep
the UI from repeating the `type` check at every call site and eventually getting one
of them backwards.

One action per group rather than a single generic `{ group, patch }` was deliberate.
The generic version needs a mapped type to tie `patch` to `group`, and when it is
wrong the error names the mapped type rather than the field.

`replace` exists for session 6: a restored save arrives as a whole input and the
reducer should not have to learn anything about storage to accept it.

### 2. Serializability is tested, not assumed

Three later jobs — session 6's autosave, v2's shareable URL fragment, v2's compare
mode — all assume `JSON.parse(JSON.stringify(state))` is the same value. A `Date`, a
class instance or an `undefined` in the defaults breaks all three at once, and breaks
them in session 6, far from the change that caused it. So `reducer.test.ts` walks the
default input and asserts every leaf is a string, number or boolean, and round-trips
the state after a run of edits. It is a cheap test for a failure that would otherwise
surface as "my saved offer came back blank".

### 3. Defaults invent no compensation figure

`defaultCompensationInput()` opens with `baseSalary: 0`, no match, no premium, and
`equity: { type: 'none' }`. Schedule assumptions (40 hours, 15 PTO days, 11 holidays)
come from `constants.ts`, where they are already labelled assumptions; compensation
figures do not get the same treatment, because a plausible invented salary on first
load is exactly the "guess presented as a fact" invariant 6 exists to prevent.

`equity` defaults to `none` rather than `unknown`: `unknown` emits a warning telling
the user their equity is unvalued, and on first load the app does not know that they
have any.

### 4. Parsing: `null` means "unreadable", not "zero"

`parseNumeric` accepts `180000`, `180,000`, `$180,000`, `180k`, `$1.8m`. It returns
`null` for text it cannot read and `0` only for a genuinely empty field. The
distinction is load-bearing: a user halfway through a paste has not said their salary
is nothing, so the field keeps the last good number, leaves the characters visible,
and marks itself `aria-invalid`. A parser that returned 0 instead would silently wipe
the figure.

**`180 000` is rejected.** Accepting a space as a group separator is indistinguishable
from accepting `1 2` as twelve, and a typo that silently becomes a plausible number is
worse than one that is visibly refused. The brief asked for commas, `k`, and `$`;
space-separated groups were never on the list. This came out of a failing test I had
written both ways by accident — worth recording so a future session does not "fix"
the rejection.

### 5. Fields hold a draft string while they are being typed in

A field whose value is re-formatted on every keystroke fights the user: type `180,`
and the comma vanishes. So each field keeps `draft: string | null`, where `null` means
"not being edited — render the committed number". The parsed value is pushed to the
reducer on each keystroke so the result stays live; the draft is dropped on blur.
Rounding happens only in `format.ts`, never in state.

### 6. The headline card is sticky, not the result column

DESIGN.md §6 asks for a sticky result panel. The full panel — headline, tax slider,
breakdown, warnings, five note cards — does not fit on a laptop screen, and both ways
of pinning the whole thing fail: pin it and the bottom is unreachable; give the column
its own scrollbar and the big number scrolls out of the panel, which is the one thing
that was supposed to stay put. So the first card sticks and the rest flows. On mobile
a separate `MobileSummaryBar` pins the figure to the bottom edge; it is `aria-hidden`,
because everything in it is already announced by the panel's live region and hearing
the rate twice with no way to tell the two apart is worse than not hearing it.

### 7. Accessibility decisions worth not re-deriving

- **The live region is debounced to 700ms.** The result recomputes per keystroke;
  a polite region updated twenty times queues twenty announcements and keeps talking
  after the user has stopped typing.
- **The tax slider reports percent, not decimals.** A range stepping in 0.01 announces
  `aria-valuenow="0.32"`, which reads as "nought point three two". The slider works in
  integer percent with an explicit `aria-valuetext` of `32%`.
- **The slider's text box has its own label.** A control sharing another control's
  label is an unlabelled control.
- **`helpId()` lives in `src/ui/ids.ts`.** Writing the `aria-describedby` string twice
  is how it eventually gets written two ways; a mismatch is invisible in a browser.
- **Estimated values are marked by shape and by a word**, never by colour alone:
  a dashed border, italics, and an `est.` badge that expands to a full phrase for
  screen readers.

**Contrast was measured, not estimated**, over the exact hex values in `index.css`,
and the first pass failed: `--color-line-strong` — the border that is the only
indication of where an input is — sat at 2.2:1 against its surface in both themes,
against the 3:1 that WCAG 1.4.11 requires for a control boundary. Darkened to `#857d75`
(light, 3.9:1) and lightened to `#7b736c` (dark, 4.2:1). Every text pair clears AA
with margin; the ratios in the comments are the measured ones. Re-measure on any
change — that is the whole reason both palettes live in one file.

### 8. `calculate` runs on every render, unmemoized

It is pure, it touches a few dozen numbers, and it runs in well under a millisecond.
A `useMemo` would add a dependency array to keep correct in exchange for nothing
measurable. If that stops being true the fix is a memo in `App.tsx`, never a cache
inside the engine.

### Fixture A, verified by hand in the browser

The six always-visible inputs **cannot express Fixture A**. It also needs a bonus
percentage, an employer HSA contribution, free meals and an RSU grant, all of which
live in session 6's collapsible sections. So it was verified in two parts, both
against the running dev server:

1. **Through the rendered UI.** Typing Fixture A's six fields (180,000 / 45h / 20 PTO
   / 11 holidays / 7,200 match / 14,000 premium) at a 32% rate gives
   **2,061 hours worked** and **$86.54** naive — both exactly Fixture A — with
   **$97.62/hr** face value and **$100.82/hr** salary-equivalent on the $201,200 that
   those six fields amount to. Hand-check: 201,200 ÷ 2,061 = 97.6225; 187,200 +
   14,000/0.68 = 207,788.24, ÷ 2,061 = 100.82.
2. **Through the real render boundary, on the full fixture.** `calculate` and
   `format.ts` were imported from the live page and handed the complete Fixture A
   input. They returned **$120.64** face value, **$124.85** salary-equivalent,
   **$86.54** naive, **$248,635** and **$257,310**, over **2,061 hours** and
   **229 days** — Fixture A to the cent, through the same formatters the components
   call.

The gap between the two is the session-6 inputs, not a disagreement. Re-verify part 1
against the full fixture once those sections exist.

### Deferred to session 6

- The remaining ~20 inputs, in collapsible sections — including the equity section,
  which is what makes the `showExpectedValue` toggle and the funding-stage selector
  from the session-4 follow-up reachable.
- `localStorage` autosave and the restore guard. `replace` is already in the reducer
  for it.
- Revisit whether the three unconditional note cards (`severance-policy`,
  `on-call-burden`, `remote-vs-in-office`) should collapse into one "Questions worth
  asking" card — carried over from session 4, and now answerable because the layout
  exists. Current read, having seen them render: they are long enough that three
  cards is a lot of unconditional text, and one card with three bullets would sit
  better under the breakdown.
- `eslint.config.js` has a dead block at the top: a `defineConfig` imported from
  `vite` and called with an ESLint config whose result is discarded. Harmless, but it
  is confusing to read and should go. Not touched here — it was outside the session's
  scope and is not a UI change.

**Gates after this session:** typecheck, lint, build clean; **560 tests passing**
(512 engine, 48 new in `src/state/` and `src/ui/`), none skipped.

---

## 2026-10-20 — Session 5 follow-up: pnpm, and a dead block in the ESLint config

### `pnpm dev` was failing, and it was the repo's fault, not the machine's

`node_modules/.pnpm` exists and `pnpm-lock.yaml` is committed — this has been a pnpm
project all along. I used `npm run` throughout session 5, which is why I never hit
the failure:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.2
```

pnpm refuses to run a dependency's install scripts unless the package is approved,
and `pnpm dev` runs a dependency check that shells out to `pnpm install` first — so
it fails before Vite starts. The default is right: an install script runs arbitrary
code on your machine before you have read a line of it. esbuild needs its script to
put the prebuilt `@esbuild/<platform>` binary in place, and Vite's dev server and
build both depend on esbuild.

Fixed with `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

Two details worth recording so the next person does not lose the time I did:

- **The settings moved.** A `pnpm` field in package.json is no longer read
  (`[WARN] The "pnpm" field in package.json is no longer read by pnpm`). As of pnpm
  10 the settings file is `pnpm-workspace.yaml`, even in a single-package repo.
- **The key is version-dependent.** pnpm 10 took `onlyBuiltDependencies`, a list;
  pnpm 11 takes `allowBuilds`, a map. I wrote the pnpm 10 form first and it was
  silently ignored. `pnpm approve-builds esbuild` writes the correct form.

`"packageManager": "pnpm@11.17.0"` is now pinned in package.json so the tool is not a
matter of local habit, and CLAUDE.md's commands say `pnpm` rather than `npm` —
including `pnpm lint`, which the working-agreement line had been omitting.

### Lockfiles are now Prettier-ignored

`pnpm lint` then failed on `pnpm-lock.yaml`, which pnpm had just rewritten. A lockfile
is generated and is not ours to style; reformatting one produces a large diff of pure
noise. `pnpm-lock.yaml` and `package-lock.json` are in `.prettierignore`.

### The dead `defineConfig` block is gone

`eslint.config.js` opened with `defineConfig` imported from **vite** and called with
an ESLint config whose return value was discarded. It did nothing: Vite's
`defineConfig` is an identity function, and ESLint only ever reads the `export
default` below it. It duplicated the real config, so the hazard was not cost but
confusion — someone editing the rules at the top of the file would have changed
nothing at all. Removed, along with the now-unused `vite` import.

**Gates after this change, all run under pnpm:** typecheck, lint, build clean;
**560 tests passing**, none skipped. `pnpm dev` serves on :5173.

---

## 2026-10-20 — Session 5 follow-up: the result panel does not stick on desktop

Reverses item 6 of the session 5 entry, on use rather than on principle.

DESIGN.md §6 specified a sticky result panel and session 5 built one, settling on
pinning just the headline card after the two obvious approaches failed — the whole
column pinned leaves its bottom unreachable, and the column with its own scrollbar
lets the big number scroll out of the panel that was meant to hold it.

Pinning the headline card solves both of those and is still the wrong answer. What
hangs over the content you are scrolling to read is, by construction, the thing you
have already read: the naive anchor and the headline figure. Everything a reader
scrolls *for* — the breakdown, the warnings, the note cards — is underneath it, and
on a laptop the card is tall enough to take a real bite out of the viewport.

The general rule this is an instance of: **sticky earns its keep when the pinned
element is a control you keep reaching for, not when it is an output.** The tax
slider would be a defensible thing to pin. The answer is not. And on desktop the
result already sits beside the field being typed into, which is the job sticky would
have been doing.

Mobile is unchanged. There the form and the result cannot share a screen, so
`MobileSummaryBar` keeps the figure pinned to the bottom edge and genuinely earns it.

DESIGN.md §6 now says "static on desktop" with a footnote, rather than leaving the
spec and the code disagreeing silently.

**Deferred, again, by request:** whether the three unconditional note cards collapse
into one "Questions worth asking" card. To be decided after session 6 lands, against
the finished product rather than against a half-built one.

**Gates:** typecheck, lint, build clean; **560 tests passing**, none skipped.

---

## 2026-10-20 — Session 6: full inputs, autosave, polish, v1

The last planned session. Everything in `CompensationInput` is now reachable from the
UI, the input survives a reload, and the app has the explainer and the disclaimer it
needs to be shown to a stranger.

### 1. A seventh section, which the spec did not ask for

DESIGN.md §6 lists six collapsible sections. `CashInput` has five fields — bonus
target, bonus treatment, sign-on, expected tenure, clawback window — that belong to
none of them, and **Fixture A cannot be entered through the UI without the bonus**,
which made this a correctness problem rather than a tidiness one. The options were to
scatter cash fields into unrelated sections or to add "Bonus & sign-on". A seventh
accordion is the smaller deviation. DESIGN.md §6 now lists seven with a footnote.

### 2. The marginal tax rate did not move into the "Tax assumption" section

Both §6 and session 5's brief are right about their own half: §6 calls for a tax
section, and session 5 put the slider in the result panel. Having both would mean two
sliders bound to one value, and the second one always looks like the stale copy.

The slider stays where the figure it moves is visible. The section holds the
**deferred rate**, which the engine has supported since session 2 (`tax.deferredRate`,
with a `deferredRateRaised` warning already written for it) and which no UI had ever
exposed. So the section is not a placeholder — it is the first time that control has
existed.

### 3. The collapsed-section header states its contribution

The brief asked for this and it turned out to carry more weight than expected. The
figure comes from `result.lineItems` — the engine's output — and never from a second
calculation over the input, so a header can't disagree with the breakdown beside it.
Three consequences worth keeping:

- the summary is `null`, rendered as an em dash, when nothing has been entered. `$0`
  and "untouched" are different states and a header that conflates them is lying;
- **"Time & leave" summarises in hours, not dollars.** Almost nothing in that section
  adds money — a sabbatical, unpaid leave and the working pattern all change the
  denominator (invariant 2), and a dollar figure there would imply otherwise;
- the equity header reads `$0` with the note "in the headline — see the range" for a
  private grant, because that is exactly what the engine did.

### 4. Autosave: what the guard checks, and what it deliberately does not

`isSavedInput` verifies the version and that every numeric leaf the engine divides by
or sums is a finite number. It does **not** range-check, because the engine already
launders its own inputs (`nonNegative`, `clamp`) and Fixture C is the test that a
degenerate input cannot produce `NaN` — a second copy of those bounds in the guard
would be a copy free to diverge.

It also does not check the string-typed enums (`bonusTreatment`, `coverageTier`,
`stipendTaxTreatment`, `optionClass`, `stage`). Every one is read through an equality
test in the engine — `=== 'earned'`, `=== 'family'` — so an unrecognized value lands
on the documented default rather than propagating. A bad *number* is the only thing
that can reach the arithmetic, which is why numbers are the only thing checked.

Unions are validated per-variant rather than by required-key list: `{ type: 'none' }`
has no fields at all, and a PTO plan tagged `accrual` carrying `expectedDaysTaken` is
rejected — the exact shape a patched discriminated union would produce.

### 5. Reset clears the save, and an untouched input is never written

DESIGN.md §5 wires reset to clearing the save. Two things follow that are easy to get
wrong:

**The clear happens in a dispatch wrapper in `App`, not in the reducer's `reset`
case.** A reducer must be a pure function of its arguments; React invokes reducers
twice in development specifically to surface side effects hiding in them.

**`saveInput` removes the key instead of writing when the input equals the defaults.**
Without this, reset cleared the save and the 500ms debounced autosave then wrote the
fresh defaults back 500ms later — so the footer's "Reset to defaults erases the saved
copy" would have been false half a second after it was true. Verified in the browser:
nothing in storage after a reset, before or after the debounce.

### 6. The Content-Security-Policy is how invariant 7 stops being a promise

`public/_headers` ships `connect-src 'none'`. Invariant 7 — no salary data leaves the
browser — is currently enforced by the fact that nobody has written a `fetch`. That
holds until someone adds an analytics snippet in good faith. With the header, the
browser refuses the request, and re-enabling network access means editing a line whose
comment says why it is there. For an app whose front page makes a privacy claim, the
claim should be enforced by something other than everyone's continued good intentions.

### 7. Two accessibility defects found by measurement, not by reading

Both were pre-existing and neither was visible:

- **The breakdown's `<dl>` was malformed.** A `div` inside a `<dl>` may contain only
  `dt` and `dd` as direct children; ours wrapped them in a second flex `div` and put a
  `<ul>` of rows alongside. Assistive technology pairs terms with definitions
  structurally, so a malformed list announces its pairs wrongly. Restructured so each
  group is `div > dt + dd`, with the itemised rows inside the `dd`. Lighthouse
  accessibility went 91 → **100**.
- **The explainer's headings jumped `h1` → `h3`.** Fixed by putting the heading inside
  the `<summary>`, which is also the pattern that makes a disclosure navigable by
  heading.

### 8. What was verified, and how

Reported in full in the session summary. In short: all 587 tests green; Fixture A
typed into the live UI gives **$120.64 / $124.85 / $86.54, $248,635 / $257,310, 2,061
hours** — exact; autosave round-trips every field through a reload; a bumped
`STORAGE_VERSION` loads clean defaults with no console error; the whole form is
keyboard-operable including the radio group, the disclosures and the slider;
Lighthouse accessibility **100**; axe-core **0 violations** on the fully-populated page
with every section open; no horizontal scroll at 360px; contrast passes AA in both
themes by measurement.

**Not done: the deploy.** `wrangler` needs an interactive `wrangler login` against the
owner's Cloudflare account, which is not something this session can or should do on
someone's behalf. Everything else is ready: `pnpm deploy`, the settings table in the
README, and `public/_headers`.

### Queued for v2 (DESIGN.md §8 stands, with these additions)

- **Compare two offers.** Still the reason the input is one serializable object.
- **Shareable URL-fragment links** — and the point at which a runtime validation
  library (Zod) earns its place, because a pasted URL is untrusted input in a way a
  same-origin `localStorage` blob is not.
- **The note cards.** Still deferred by request: whether the three unconditional cards
  collapse into one "Questions worth asking". Now decidable against a finished product.
- An `aria-live` announcement when a section's contribution changes while collapsed.
- Component tests. There are none — this session's UI was verified by hand in a
  browser, which found real defects but does not run in CI.

**Gates:** typecheck, lint, build clean; **587 tests passing**, none skipped.

---

## 2026-10-20 — Session 6 follow-up: the match takes a percentage on the field itself

Both forms of the employer 401(k) match were supported from the start, but the
percentage form was only reachable from the collapsed "Retirement & savings" section
while the always-visible field took dollars only. That is backwards: **"4% of salary"
is how plan documents state a match**, so the form that requires no arithmetic was the
one hidden behind a disclosure, and the visible field was the one demanding the user
multiply by their own salary.

`MatchField` now puts a `$ / year` ↔ `% of base` switch on the field, and shows the
derived figure live underneath — `= $6,300 a year on a $180,000 salary`. Changing the
salary moves it, which is the entire reason to hold a match as a percentage rather
than as a frozen dollar amount.

**The section no longer offers a second copy of the control.** Same rule as the tax
slider in item 2 of the session 6 entry: two controls bound to one value is how a form
starts contradicting itself. The section keeps the cap — which only a percentage match
can have — and the vesting, and states the current figure with a pointer upward.

### Conversions, not resets

Switching units runs `asAmountMatch` / `asPercentMatch` (in `state/reducer.ts`, tested
in `reducer.test.ts`). Three judgments in those:

- **The dollar figure comes from the engine's own `employerMatchAmount`**, so the
  number that lands in the field is the number the calculation was already using, cap
  included. A second implementation here would be free to disagree with the breakdown
  sitting beside it.
- **It is rounded with `dollars()`.** 3.5% of $180,000 is `6300.000000000001` in binary
  floating point, and that would sit in state and drift further on every round trip.
- **No salary yet means 0%, not a guess.** No percentage is implied by a dollar figure
  over an unknown base, and the match field sits above the salary field in some
  people's filling order.

A cap cannot survive a trip through the dollar form, because a flat amount has no
field to hold one. It is dropped rather than re-invented on the way back.

### The cap in the match note is now grouped

The engine's note for a capped percentage match used to read `capped at $5000.`. It now
reads `$5,000`, using `.toLocaleString('en-US')` the way `equity.ts` already writes its
notes, with the matching assertion in `retirement.test.ts` updated from `'5000'` to
`'5,000'`. Display text only — no calculation changed, and the purity test still
passes. Applied on the owner's approval, since engine changes are their call.

**Gates:** typecheck, lint, build clean; **594 tests passing**, none skipped.

---

## 2026-10-21 — The employer money moved into its own sections

The 401(k) match and the employer health premium left the always-visible block for
"Retirement & savings" and "Health & insurance" respectively, at the owner's request.
The always-visible form is now four fields: base salary, hours per week, PTO,
holidays — the fraction itself, nothing else.

The argument for the move is that each figure now sits beside the settings that
qualify it. A match entered above the fold and capped inside a collapsed section is a
match that can be read wrong, and the same goes for a premium whose coverage tier —
which sets the HSA limit it is checked against — lived somewhere else. Both are the
first field in their section, because both are the largest number in it.

**The cost, stated plainly because it is real:** those two are usually the biggest
employer-paid figures in a package, and a first-time visitor now sees a salary-only
result until they open something. The whole product thesis is that employer benefits
are the missing quarter, so burying them is not free. Three things carry the weight
instead — the intro line under "Your package" names them and says they are worth about
a quarter of a package, every section header states its own current contribution so
the money is legible while collapsed, and the empty result panel points at the
sections explicitly. If the finished product turns out to under-report because of
this, the fix is to lift the two fields back out, not to add a third copy of them.

DESIGN.md §6's always-visible bullet was rewritten to match, with a footnote, rather
than leaving the spec describing a page that no longer exists.

**Gates:** typecheck, lint, build clean; **594 tests passing**. Fixture A re-verified
through the moved fields: **$120.64**, 2,061 hours, $248,635. axe-core: 0 violations.

## 2026-10-22 — Field "why" copy cut to one or two sentences

Every `why=` disclosure in `src/ui/` was rewritten at the owner's request: the old
copy read as over-explained and cluttered the UI. Each one now says what the field
does to the number and, where it matters, one worked example. Dropped on purpose:
justifications of modelling choices (single tax rate vs brackets, why commute is
excluded, why option time value is unpriced). Those belong in DESIGN.md and
"How this works", not beside an input. Worked dollar examples were rechecked
($14,000 ÷ 0.68 ≈ $20,600; $10,000 ÷ 0.85 ≈ $11,765, etc.).

Same pass applied to every warning message in `src/engine/warnings.ts`. Ids,
severities and triggers are unchanged; only wording moved. Phrases the tests pin
(e.g. "private estimator", "not worthless", "always 100% yours") were kept. One
test changed: the deferred-rate warning now says "59½" to match the field copy,
instead of "59.5". The commuter and §127 warnings now say outright that the excess
"is not counted here", which is what `perks.ts` does: it drops the excess and does
not move it to `taxable`. Whether it should is **deferred**.

Then the off-headline note bodies in `src/engine/notes.ts`, same rules. Titles,
amounts and confidence unchanged. The vesting note no longer repeats "your own
contributions are always 100% vested", because the `match-vesting-cliff` warning
already says it. The severance note no longer says "not counted above", because
the section subheading in `NoteCards.tsx` already says that for every card.

## 2026-10-24 — Probability-weighted private-equity figure removed

Removed at the owner's request. Everything that existed only to feed it went too:

- Input: `PrivateEquity.showExpectedValue`, `.liquidityProbability`, `.stage`, and the
  `FundingStage` type.
- Result: `EquityScenarios.expectedValue`, `.liquidityProbabilityBasis`, and
  `assumptions.liquidityProbability`.
- Engine: `resolveLiquidityProbability`, `LIQUIDITY_PROBABILITY_BY_STAGE`,
  `DEFAULT_LIQUIDITY_PROBABILITY`, and the Zabella source citation.
- UI: the funding-stage select, the "set it myself" toggle, the probability field, the
  "show" toggle, and the panel row.

The private model is now three scenarios (zero / modest / strong) built from three
assumptions.

**Saved data:** `STORAGE_VERSION` was deliberately not bumped. Old saves still carry the
three removed fields. The guard ignores keys it does not check, so those saves still load
and the fields sit there unread until the user next switches equity mode. Bumping the
version would have wiped every saved form over three dead fields. A storage test pins this.

**If it comes back:** the stage table (seed 13% → Series D+ 39%) came from a secondary
source, https://www.zabella.net/blog/startup-exit-statistics, with the primary dataset
never found. It is in git history at 99382b7.
