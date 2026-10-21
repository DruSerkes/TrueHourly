/**
 * The production defaults for a brand-new `CompensationInput`.
 *
 * Every value here comes from `src/engine/constants.ts`, which is where
 * invariant 5 says a figure with a source lives. Nothing is inlined: a changed
 * default is changed in one place and this file follows it.
 *
 * ── Why most of these are zero ──────────────────────────────────────────
 *
 * A first-time visitor's result is an empty package, not a plausible one. The
 * app must not open with a $150,000 salary and a 4% match it invented — that is
 * a guess presented as a fact, which is the error invariant 6 exists to
 * prevent. Where a default genuinely is an assumption about a typical schedule
 * rather than about this user's pay (hours per week, holidays, PTO), the
 * constant carries the assumption and the UI labels it.
 *
 * This object is plain and JSON-serializable by construction — no class
 * instances, no functions, no `undefined` — which is what makes session 6's
 * `localStorage` autosave a `JSON.stringify` and nothing more.
 */

import {
  DEFAULT_DAYS_PER_WEEK,
  DEFAULT_DEFERRED_RATE,
  DEFAULT_HOLIDAY_DAYS,
  DEFAULT_HOURS_PER_WEEK,
  DEFAULT_MEAL_VALUE,
  DEFAULT_PTO_DAYS,
  DEFAULT_TAX_RATE,
  DEFAULT_VEST_YEARS,
} from '../engine/constants.ts';
import type { CompensationInput } from '../engine/types.ts';

/**
 * A fresh input with every field at its default.
 *
 * Returns a new object every call, deliberately: the reducer's `reset` action
 * hands this straight back as state, and a shared frozen singleton would make
 * two resets alias the same object.
 */
export function defaultCompensationInput(): CompensationInput {
  return {
    hours: {
      hoursPerWeek: DEFAULT_HOURS_PER_WEEK,
      daysPerWeek: DEFAULT_DAYS_PER_WEEK,
      ptoPlan: { type: 'accrual', ptoDays: DEFAULT_PTO_DAYS, expectedAccruedBalanceDays: 0 },
      holidayDays: DEFAULT_HOLIDAY_DAYS,
      unpaidLeaveDays: 0,
      sabbaticalWeeks: 0,
      sabbaticalCycleYears: 0,
      hoursWorkedOverride: null,
      commuteMinutesOneWay: 0,
    },
    cash: {
      baseSalary: 0,
      bonusTargetPct: 0,
      bonusTreatment: 'target',
      signOnBonus: 0,
      expectedTenureYears: DEFAULT_VEST_YEARS,
      signOnClawbackMonths: 0,
    },
    // `none` rather than `unknown`: `unknown` emits a warning telling the user
    // their equity is unvalued, which is not something the app knows on first
    // load. The equity section (session 6) is where they say which it is.
    equity: { type: 'none' },
    retirement: {
      employerMatch: { type: 'amount', annualAmount: 0 },
      matchVestingYears: 0,
      profitSharing: 0,
      studentLoanMatch: 0,
      espp: null,
    },
    health: {
      employerPremiumContribution: 0,
      employerHsaContribution: 0,
      employerFsaSeed: 0,
      coverageTier: 'self_only',
    },
    insurance: { lifeAndAddPremium: 0, lifeCoverageAmount: 0, disabilityPremium: 0 },
    perks: {
      meals: { enabled: false, valuePerDay: DEFAULT_MEAL_VALUE },
      commuterBenefitMonthly: 0,
      tuitionReimbursement: 0,
      homeOfficeStipend: 0,
      wellnessStipend: 0,
      professionalDevelopment: 0,
      stipendTaxTreatment: 'taxable',
    },
    leave: {
      parentalLeaveWeeks: 0,
      parentalLeaveWeeklyRate: 0,
      includeParentalLeaveInHeadline: false,
    },
    tax: { combinedMarginalRate: DEFAULT_TAX_RATE, deferredRate: DEFAULT_DEFERRED_RATE },
  };
}
