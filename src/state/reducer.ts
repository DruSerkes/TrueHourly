/**
 * The app's only mutable state: one `CompensationInput` in one `useReducer`.
 *
 * No state library, per CLAUDE.md. The reason is not minimalism for its own
 * sake — it is that keeping the whole input in a single plain object is what
 * makes three later jobs cheap:
 *
 *   - session 6's autosave is `JSON.stringify(state)` and a guard on the way
 *     back in;
 *   - v2's shareable link is the same string, encoded into the URL fragment;
 *   - v2's compare mode is `CompensationInput[]` and a diff, not a rewrite.
 *
 * So the invariant this file keeps is: **state stays plain and serializable.**
 * No class instances, no functions, no `Date`, no `undefined` as a value, and
 * no derived figures cached in here. Everything derived comes from
 * `calculate(state)`, which is pure and fast enough to run on every keystroke.
 *
 * ── Why the actions are shaped the way they are ─────────────────────────
 *
 * `CompensationInput` is nine groups of flat fields plus three discriminated
 * unions. Those two shapes want different actions:
 *
 *   - A flat group takes `patch*` with a `Partial` of that group. One action
 *     per group rather than one generic `{ group, patch }` action, because a
 *     generic one cannot be typed so that `patch` matches `group` without a
 *     mapped-type contortion that produces worse errors than it prevents.
 *   - A union (`equity`, `ptoPlan`, `employerMatch`) is REPLACED WHOLE, never
 *     patched. Patching a discriminated union is how you end up with
 *     `{ type: 'unlimited', ptoDays: 20 }` — a value whose fields contradict
 *     its own tag. The caller builds a complete, valid member and hands it over.
 *
 * `replace` exists for session 6: a restored save arrives as a whole input, and
 * the reducer should not have to learn anything about storage to accept it.
 */

import { dollars } from '../engine/numbers.ts';
import { employerMatchAmount } from '../engine/retirement.ts';
import { defaultCompensationInput } from './defaults.ts';
import type {
  CashInput,
  CompensationInput,
  EmployerMatch,
  EquityInput,
  HealthInput,
  HoursInput,
  InsuranceInput,
  LeaveInput,
  PerksInput,
  PtoPlan,
  RetirementInput,
  TaxInput,
} from '../engine/types.ts';

export type InputAction =
  /** Back to a fresh input. Session 6 also clears the save on this. */
  | { type: 'reset' }
  /** Adopt a whole input wholesale — a restored save, or a pasted link in v2. */
  | { type: 'replace'; input: CompensationInput }
  | { type: 'patchHours'; patch: Partial<HoursInput> }
  | { type: 'patchCash'; patch: Partial<CashInput> }
  | { type: 'patchRetirement'; patch: Partial<RetirementInput> }
  | { type: 'patchHealth'; patch: Partial<HealthInput> }
  | { type: 'patchInsurance'; patch: Partial<InsuranceInput> }
  | { type: 'patchPerks'; patch: Partial<PerksInput> }
  | { type: 'patchLeave'; patch: Partial<LeaveInput> }
  | { type: 'patchTax'; patch: Partial<TaxInput> }
  /** Whole-value replacement — see the header on why unions are not patched. */
  | { type: 'setEquity'; equity: EquityInput }
  | { type: 'setPtoPlan'; ptoPlan: PtoPlan }
  | { type: 'setEmployerMatch'; employerMatch: EmployerMatch };

/**
 * The reducer. Never mutates: every branch spreads, so a previous state handed
 * to `calculate` stays the value it was. That matters more than it looks —
 * React 19 Strict Mode double-invokes reducers in development, and a reducer
 * that mutated would produce different answers on the two calls.
 */
export function inputReducer(state: CompensationInput, action: InputAction): CompensationInput {
  switch (action.type) {
    case 'reset':
      return defaultCompensationInput();
    case 'replace':
      return action.input;
    case 'patchHours':
      return { ...state, hours: { ...state.hours, ...action.patch } };
    case 'patchCash':
      return { ...state, cash: { ...state.cash, ...action.patch } };
    case 'patchRetirement':
      return { ...state, retirement: { ...state.retirement, ...action.patch } };
    case 'patchHealth':
      return { ...state, health: { ...state.health, ...action.patch } };
    case 'patchInsurance':
      return { ...state, insurance: { ...state.insurance, ...action.patch } };
    case 'patchPerks':
      return { ...state, perks: { ...state.perks, ...action.patch } };
    case 'patchLeave':
      return { ...state, leave: { ...state.leave, ...action.patch } };
    case 'patchTax':
      return { ...state, tax: { ...state.tax, ...action.patch } };
    case 'setEquity':
      return { ...state, equity: action.equity };
    case 'setPtoPlan':
      return { ...state, hours: { ...state.hours, ptoPlan: action.ptoPlan } };
    case 'setEmployerMatch':
      return { ...state, retirement: { ...state.retirement, employerMatch: action.employerMatch } };
  }
}

/**
 * Days of PTO a plan grants or expects, whichever its mode calls it.
 *
 * Both modes have a days figure and the denominator treats them identically
 * (DESIGN.md §2.1) — only the separation-payout note differs. The UI renders
 * one PTO field, so it needs one reader; without this, every call site repeats
 * the same `type` check and one of them eventually gets it backwards.
 */
export function ptoDaysOf(plan: PtoPlan): number {
  return plan.type === 'accrual' ? plan.ptoDays : plan.expectedDaysTaken;
}

/**
 * The same plan with a new day count, preserving the mode and its other fields.
 * Returns a complete union member, which is the whole point — see the header.
 */
export function withPtoDays(plan: PtoPlan, days: number): PtoPlan {
  return plan.type === 'accrual'
    ? { ...plan, ptoDays: days }
    : { ...plan, expectedDaysTaken: days };
}

/**
 * The 401(k) match as a flat dollar figure, for the one always-visible field.
 *
 * `percent_of_base` has no dollar figure of its own without a salary, so it
 * reports 0 here rather than inventing one; the percent form gets its own field
 * in session 6's retirement section.
 */
export function matchAmountOf(match: EmployerMatch): number {
  return match.type === 'amount' ? match.annualAmount : 0;
}

/**
 * The same match, restated as a flat dollar amount.
 *
 * Conversion rather than replacement: switching how you *describe* the match is
 * not a statement that it changed, so a 4%-of-$180,000 match becomes $7,200 and
 * not $0. `employerMatchAmount` is the engine's own function, so the figure the
 * field lands on is the figure the engine was already using — the user sees the
 * number they would have had to work out by hand, and it cannot drift from the
 * calculation.
 */
export function asAmountMatch(match: EmployerMatch, baseSalary: number): EmployerMatch {
  if (match.type === 'amount') return match;
  // Rounded to whole dollars, per the storage convention — and because binary
  // floating point makes 3.5% of $180,000 come out as 6300.000000000001, which
  // would sit in state and drift a little further on every round trip.
  return { type: 'amount', annualAmount: dollars(employerMatchAmount(match, baseSalary)) };
}

/**
 * The same match, restated as a percentage of base.
 *
 * The inverse needs a salary to divide by, and there may not be one yet — the
 * match field sits above the salary field in some people's filling order. With
 * no salary the percentage is 0, which is honest: there is no percentage that a
 * dollar figure implies when the base is unknown, and inventing one would put a
 * number in the field that the user did not choose.
 *
 * The new percentage match is uncapped. A cap cannot survive a trip through the
 * dollar form — a flat amount has no cap field to hold it — and `null` is the
 * honest landing point, because the alternative is inventing a ceiling the user
 * never set. The cap is preserved while the match stays in percentage form,
 * which is where it is edited.
 */
export function asPercentMatch(match: EmployerMatch, baseSalary: number): EmployerMatch {
  if (match.type === 'percent_of_base') return match;
  const percentOfBase = baseSalary > 0 ? match.annualAmount / baseSalary : 0;
  return { type: 'percent_of_base', percentOfBase, capDollars: null };
}
