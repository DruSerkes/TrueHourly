/**
 * Engine types.
 *
 * Unit conventions, applied without exception (CLAUDE.md "Conventions"):
 *   - Money is **whole dollars per year** unless a field name says otherwise
 *     (`PerDay`, `PerShare`, `Weekly`). Formatting happens at the render
 *     boundary, never in here.
 *   - Rates are **decimals** (0.04), never percentages (4). Any percentage-shaped
 *     value is suffixed `Pct` so the conversion point is obvious at the call site.
 *   - Counts of time are stated in their own unit (`Days`, `Weeks`, `Years`).
 *
 * This file must not import React, touch the DOM, or read `window`
 * (invariant 1, enforced by `__tests__/purity.test.ts`).
 */

// ---------------------------------------------------------------------------
// Output primitives — verbatim from DESIGN.md §3
// ---------------------------------------------------------------------------

/**
 * Which tax treatment a dollar receives. Every dollar in the model belongs to
 * exactly one bucket (invariant 3).
 *
 * - `taxable`      — face value; no gross-up.
 * - `tax_free`     — grossed up by `1 / (1 - t)`: a tax-free dollar is worth more
 *                    than a salary dollar.
 * - `tax_deferred` — face value by default. An employer 401(k) match is taxed as
 *                    ordinary income on withdrawal and is illiquid until 59½, so
 *                    it must NOT be grossed up like `tax_free`.
 */
export type TaxBucket = 'taxable' | 'tax_free' | 'tax_deferred';

/**
 * How much the app trusts a number.
 *
 * - `entered`   — the user typed it.
 * - `estimated` — the app derived or defaulted it; must render visually distinct.
 * - `unknown`   — genuinely unknown; contributes $0 to the headline.
 */
export type Confidence = 'entered' | 'estimated' | 'unknown';

/** Grouping used for the contribution breakdown in the result panel. */
export type Category =
  'cash' | 'equity' | 'retirement' | 'health' | 'insurance' | 'leave' | 'perks';

/** One line of the numerator. Never a PTO line — see invariant 2. */
export interface LineItem {
  /** Stable machine id, e.g. `'base-salary'`. Unique within a result. */
  id: string;
  /** Human-readable label for the breakdown row. */
  label: string;
  category: Category;
  bucket: TaxBucket;
  /** Whole dollars per year, face value (no tax modelling applied). */
  annualValue: number;
  /** Whole-dollar-per-year value after bucket gross-up. May be fractional. */
  salaryEquivalent: number;
  confidence: Confidence;
  /** Optional plain-language caveat shown next to the row. */
  note?: string;
}

/** The denominator, fully shown so the user can audit it. */
export interface HoursBreakdown {
  /** Hours per working week. */
  hoursPerWeek: number;
  /** Working days per week; divides day counts into weeks. Default 5. */
  daysPerWeek: number;
  /** Paid time off, in days per year. */
  ptoDays: number;
  /** Company holidays, in days per year. */
  holidayDays: number;
  /** Unpaid leave, in days per year. */
  unpaidLeaveDays: number;
  /** Hours actually worked per year — the headline denominator. */
  hoursWorked: number;
  /** Days actually worked per year; drives per-day perks such as free meals. */
  daysWorked: number;
  /** True when the user overrode `hoursWorked` directly instead of deriving it. */
  overridden: boolean;
}

/**
 * Private-equity valuation range. Dollars per year of vesting.
 * The headline always uses `zero` (invariant 6).
 */
export interface EquityScenarios {
  /** Dollars per year if the equity is ultimately worth nothing. Always 0. */
  zero: number;
  /** Dollars per year at roughly the last round's valuation. */
  modest: number;
  /** Dollars per year at `modest × strongMultiple`. */
  strong: number;
  /** `modest × liquidityProbability`. Shown only when the user opts in. */
  expectedValue: number;
  /**
   * The assumptions that produced the above, echoed back for display so the UI
   * never has to reach into the input. Decimal rates and plain multiples;
   * keys match the `PrivateEquity` field names.
   */
  assumptions: Record<string, number>;
}

/** Structured warning emitted by the engine; the UI renders, never infers. */
export interface Warning {
  /** Stable machine id, e.g. `'long-hours'`. */
  id: string;
  severity: 'info' | 'caution';
  /** Plain-language sentence, already user-facing. */
  message: string;
}

/** The complete engine output. */
export interface TrueHourlyResult {
  hours: HoursBreakdown;
  lineItems: LineItem[];
  /** Annual dollar totals across all line items. */
  totals: { faceValue: number; salaryEquivalent: number };
  /** Dollars per hour worked. Both are always computed (invariant 4). */
  trueHourly: { faceValue: number; salaryEquivalent: number };
  /** `baseSalary / 2080` — the anchor the user arrived believing. Dollars per hour. */
  baseHourlyNaive: number;
  /** Present only for `equity.type === 'private'`. */
  equityScenarios?: EquityScenarios;
  warnings: Warning[];
}

// ---------------------------------------------------------------------------
// Input — derived from DESIGN.md §2.3 and §2.4
// ---------------------------------------------------------------------------

/**
 * Whether a stipend is paid as cash wages (taxable) or reimbursed under an
 * accountable plan (tax-free). Defaults to taxable per DESIGN.md §2.3 note 1.
 */
export type StipendTaxTreatment = 'taxable' | 'tax_free';

/** Hours and time off — the denominator's inputs (DESIGN.md §2.1). */
export interface HoursInput {
  /** Hours per working week. */
  hoursPerWeek: number;
  /** Working days per week. */
  daysPerWeek: number;
  /**
   * `accrual` plans carry a payout balance at separation; `unlimited` plans are
   * worth $0 at exit. The distinction changes the off-headline note only — the
   * denominator math is identical (DESIGN.md §2.1).
   */
  ptoPlan: PtoPlan;
  /** Company holidays, in days per year. */
  holidayDays: number;
  /** Unpaid leave the user expects to take, in days per year. */
  unpaidLeaveDays: number;
  /**
   * Direct override of annual hours worked. `null` means derive it.
   * When set, `HoursBreakdown.overridden` is true.
   */
  hoursWorkedOverride: number | null;
  /**
   * One-way commute, in minutes. Collected but excluded from the headline
   * denominator; feeds the secondary "hours the job consumes" view.
   */
  commuteMinutesOneWay: number;
}

/** Discriminated union: the PTO days field means something different in each mode. */
export type PtoPlan =
  | {
      type: 'accrual';
      /** Days of PTO granted per year. */
      ptoDays: number;
      /** Days expected to be on the books at separation; drives the payout note. */
      expectedAccruedBalanceDays: number;
    }
  | {
      type: 'unlimited';
      /** Days the user realistically expects to take per year. Default 15. */
      expectedDaysTaken: number;
    };

/** Cash compensation (DESIGN.md §2.3, `cash`). */
export interface CashInput {
  /** Annual base salary, whole dollars. */
  baseSalary: number;
  /** Target annual bonus as a decimal share of base (0.10 = 10%). */
  bonusTargetPct: number;
  /** Sign-on bonus, whole dollars, paid once. */
  signOnBonus: number;
  /** Years over which the sign-on is amortized — the tenure the user expects. */
  expectedTenureYears: number;
  /** Clawback window on the sign-on, in months. 0 = none. Drives a warning. */
  signOnClawbackMonths: number;
}

/** Equity. Discriminated on `type` (DESIGN.md §2.4). */
export type EquityInput =
  { type: 'none' } | { type: 'unknown' } | PublicEquity | PrivateEquity | OptionsEquity;

/** Public-company RSUs: price is observable, so the value is a fact. */
export interface PublicEquity {
  type: 'public';
  /** Total shares in the grant (not per year). */
  grantShares: number;
  /** Current market price, dollars per share. User-supplied; we don't call an API. */
  pricePerShare: number;
  /** Years the grant vests over. */
  vestYears: number;
  /** Months until the first vest. 12 makes year 1 contingent; drives a warning. */
  cliffMonths: number;
}

/** Private-company shares: never a single confident number (DESIGN.md §2.4). */
export interface PrivateEquity {
  type: 'private';
  /** Total shares or units in the grant. */
  grantShares: number;
  /** Last preferred-round price, dollars per share. */
  lastPreferredPricePerShare: number;
  /** Years the grant vests over. */
  vestYears: number;
  /** Months until the first vest. */
  cliffMonths: number;
  /** Haircut for common-vs-preferred, decimal. Assumption, not a fact. Default 0.30. */
  commonDiscount: number;
  /** Expected future dilution, decimal. Assumption. Default 0.25. */
  expectedDilution: number;
  /** Multiple on the last round for the `strong` scenario. Assumption. Default 3. */
  strongMultiple: number;
  /** Probability of any liquidity event, decimal. Assumption. Default 0.30. */
  liquidityProbability: number;
  /** When true the UI may show `expectedValue`. Never enters the headline. */
  showExpectedValue: boolean;
}

/** Stock options: intrinsic value only, clamped at 0 (DESIGN.md §2.4). */
export interface OptionsEquity {
  type: 'options';
  /** Total options in the grant. */
  grantShares: number;
  /** Strike price, dollars per share. */
  strikePrice: number;
  /** Current fair market value, dollars per share. */
  fairMarketValue: number;
  /** Years the grant vests over. */
  vestYears: number;
  /** Months until the first vest. */
  cliffMonths: number;
  /** ISOs carry AMT exposure on exercise; drives a different warning than NSOs. */
  optionClass: 'iso' | 'nso';
}

/** Retirement and savings (DESIGN.md §2.3, `retirement`). */
export interface RetirementInput {
  /** Employer 401(k) match, whole dollars per year. */
  employerMatch: number;
  /** Years until the match is fully vested. >0 with a match drives a warning. */
  matchVestingYears: number;
  /** Employer non-elective / profit-sharing contribution, dollars per year. */
  profitSharing: number;
  /** Employer student-loan repayment match (SECURE 2.0), dollars per year. */
  studentLoanMatch: number;
  /** ESPP participation. `null` when the user has no ESPP. */
  espp: EsppInput | null;
}

/**
 * ESPP. v1 values the discount as
 * `annualContribution × discountRate / (1 - discountRate)`, i.e. the gain on
 * shares bought at a discount, and warns that this ignores the lookback
 * (which makes it worth more) and holding-period tax treatment.
 */
export interface EsppInput {
  /** Dollars per year the user contributes from payroll. */
  annualContribution: number;
  /** Purchase discount as a decimal. Default 0.15. */
  discountRate: number;
  /** True when the plan has a lookback provision; drives the undervaluation note. */
  hasLookback: boolean;
}

/** Health benefits (DESIGN.md §2.3, `health`). */
export interface HealthInput {
  /** Employer share of medical + dental + vision premium, dollars per year. */
  employerPremiumContribution: number;
  /** Employer HSA contribution, dollars per year. */
  employerHsaContribution: number;
  /** Employer FSA seed, dollars per year. */
  employerFsaSeed: number;
  /** Which HSA/FSA statutory limit applies when checking for over-contribution. */
  coverageTier: 'self_only' | 'family';
}

/** Employer-paid insurance (DESIGN.md §2.3, `insurance`). */
export interface InsuranceInput {
  /** Employer-paid life / AD&D premium, dollars per year. */
  lifeAndAddPremium: number;
  /**
   * Group term life coverage amount, whole dollars (the death benefit, not a
   * premium). Above the statutory ceiling the excess premium is imputed income;
   * v1 treats the whole premium as tax-free and notes it.
   */
  lifeCoverageAmount: number;
  /** Employer-paid short- and long-term disability premium, dollars per year. */
  disabilityPremium: number;
}

/** Perks and stipends (DESIGN.md §2.3, `perks`). */
export interface PerksInput {
  /** Free meals: valued as `mealValuePerDay × daysWorked`. */
  meals: { enabled: boolean; valuePerDay: number };
  /** Commuter / transit / parking benefit, dollars per year. */
  commuterBenefit: number;
  /** Tuition or education reimbursement, dollars per year. Capped at the §127 limit. */
  tuitionReimbursement: number;
  /** Home office / phone / internet stipend, dollars per year. */
  homeOfficeStipend: number;
  /** Wellness / gym stipend, dollars per year. */
  wellnessStipend: number;
  /** Professional development budget, dollars per year. */
  professionalDevelopment: number;
  /** Whether cash stipends are wages or accountable-plan reimbursements. */
  stipendTaxTreatment: StipendTaxTreatment;
}

/** Paid leave beyond PTO (DESIGN.md §2.3, `leave`). */
export interface LeaveInput {
  /** Paid parental leave, weeks offered. */
  parentalLeaveWeeks: number;
  /**
   * Weekly pay rate during parental leave, dollars per week. Its annual value is
   * only realized in a year leave is taken — hence the flag below.
   */
  parentalLeaveWeeklyRate: number;
  /** When false, parental leave contributes $0 and is listed as an off-headline note. */
  includeParentalLeaveInHeadline: boolean;
  /** Sabbatical length, weeks. Amortized over `sabbaticalCycleYears`. */
  sabbaticalWeeks: number;
  /** Years between sabbaticals. Must be > 0 when `sabbaticalWeeks > 0`. */
  sabbaticalCycleYears: number;
}

/** The single tax assumption (DESIGN.md §2.2). */
export interface TaxInput {
  /**
   * Combined marginal rate — federal income + FICA + state + local — as a
   * decimal. One slider, not a bracket engine: the job is unit conversion.
   * Default 0.30.
   */
  combinedMarginalRate: number;
  /**
   * Rate applied to the `tax_deferred` bucket, decimal. Default 0 (face value).
   * Raising it is an advanced toggle and must carry the illiquidity warning.
   */
  deferredRate: number;
}

/**
 * The single source of truth for the whole app. Plain and serializable by
 * construction: that is what makes `localStorage` autosave trivial now and
 * compare mode (`CompensationInput[]`) cheap in v2.
 */
export interface CompensationInput {
  hours: HoursInput;
  cash: CashInput;
  equity: EquityInput;
  retirement: RetirementInput;
  health: HealthInput;
  insurance: InsuranceInput;
  perks: PerksInput;
  leave: LeaveInput;
  tax: TaxInput;
}
