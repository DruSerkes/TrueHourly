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
