/**
 * A complete default `CompensationInput` for tests.
 *
 * Not production code: `src/state/` owns the real defaults from session 5. This
 * exists so a test can state only the fields it cares about, which is what
 * makes a failing assertion point at one input instead of forty. It lives under
 * `__tests__/` and is therefore outside the purity scan — deliberately, since
 * it is a fixture, not engine source.
 *
 * It mirrors `constants.ts` rather than hardcoding values, so a changed default
 * shows up as a failing test instead of a silently divergent fixture.
 */

import {
  DEFAULT_COMMON_DISCOUNT,
  DEFAULT_DAYS_PER_WEEK,
  DEFAULT_DEFERRED_RATE,
  DEFAULT_ESPP_DISCOUNT,
  DEFAULT_EXPECTED_DILUTION,
  DEFAULT_HOLIDAY_DAYS,
  DEFAULT_HOURS_PER_WEEK,
  DEFAULT_MEAL_VALUE,
  DEFAULT_PTO_DAYS,
  DEFAULT_STRONG_MULTIPLE,
  DEFAULT_TAX_RATE,
  DEFAULT_VEST_YEARS,
} from '../constants.ts';
import type {
  CashInput,
  CompensationInput,
  HealthInput,
  HoursInput,
  InsuranceInput,
  LeaveInput,
  PerksInput,
  RetirementInput,
  TaxInput,
} from '../types.ts';

export function defaultHours(): HoursInput {
  return {
    hoursPerWeek: DEFAULT_HOURS_PER_WEEK,
    daysPerWeek: DEFAULT_DAYS_PER_WEEK,
    ptoPlan: { type: 'accrual', ptoDays: DEFAULT_PTO_DAYS, expectedAccruedBalanceDays: 0 },
    holidayDays: DEFAULT_HOLIDAY_DAYS,
    unpaidLeaveDays: 0,
    sabbaticalWeeks: 0,
    sabbaticalCycleYears: 0,
    hoursWorkedOverride: null,
    commuteMinutesOneWay: 0,
  };
}

export function defaultCash(): CashInput {
  return {
    baseSalary: 0,
    bonusTargetPct: 0,
    bonusTreatment: 'target',
    signOnBonus: 0,
    expectedTenureYears: DEFAULT_VEST_YEARS,
    signOnClawbackMonths: 0,
  };
}

export function defaultRetirement(): RetirementInput {
  return {
    employerMatch: { type: 'amount', annualAmount: 0 },
    matchVestingYears: 0,
    profitSharing: 0,
    studentLoanMatch: 0,
    espp: null,
  };
}

export function defaultHealth(): HealthInput {
  return {
    employerPremiumContribution: 0,
    employerHsaContribution: 0,
    employerFsaSeed: 0,
    coverageTier: 'self_only',
  };
}

export function defaultInsurance(): InsuranceInput {
  return { lifeAndAddPremium: 0, lifeCoverageAmount: 0, disabilityPremium: 0 };
}

export function defaultPerks(): PerksInput {
  return {
    meals: { enabled: false, valuePerDay: DEFAULT_MEAL_VALUE },
    commuterBenefitMonthly: 0,
    tuitionReimbursement: 0,
    homeOfficeStipend: 0,
    wellnessStipend: 0,
    professionalDevelopment: 0,
    stipendTaxTreatment: 'taxable',
  };
}

export function defaultLeave(): LeaveInput {
  return {
    parentalLeaveWeeks: 0,
    parentalLeaveWeeklyRate: 0,
    includeParentalLeaveInHeadline: false,
  };
}

export function defaultTax(): TaxInput {
  return { combinedMarginalRate: DEFAULT_TAX_RATE, deferredRate: DEFAULT_DEFERRED_RATE };
}

/**
 * Private-equity assumption defaults, exported so the equity tests don't
 * re-derive them.
 */
export const PRIVATE_EQUITY_DEFAULTS = {
  commonDiscount: DEFAULT_COMMON_DISCOUNT,
  expectedDilution: DEFAULT_EXPECTED_DILUTION,
  strongMultiple: DEFAULT_STRONG_MULTIPLE,
} as const;

/** The default ESPP discount. Not a private-equity assumption — kept separate
 * so the bundle above can be spread straight into a `PrivateEquity`. */
export const ESPP_DISCOUNT_DEFAULT = DEFAULT_ESPP_DISCOUNT;

/**
 * A full input with every group at its default. Override one group at a time:
 *
 *     defaultInput({ cash: { ...defaultCash(), baseSalary: 180_000 } })
 */
export function defaultInput(overrides: Partial<CompensationInput> = {}): CompensationInput {
  return {
    hours: defaultHours(),
    cash: defaultCash(),
    equity: { type: 'none' },
    retirement: defaultRetirement(),
    health: defaultHealth(),
    insurance: defaultInsurance(),
    perks: defaultPerks(),
    leave: defaultLeave(),
    tax: defaultTax(),
    ...overrides,
  };
}
