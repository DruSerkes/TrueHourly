/**
 * Statutory limits and app defaults.
 *
 * Invariant 5: **never invent a dollar figure.** Every number in the engine that
 * isn't derived from user input lives in this file, and every statutory number
 * carries a source URL in a comment directly above it. If a calculation needs a
 * figure that isn't here, add it here with a source — do not inline a literal in
 * calculation code. If no source exists, it is not a constant: make it a
 * user-adjustable input with a labelled default.
 *
 * Two kinds of thing live here, and they are not interchangeable:
 *
 *   1. STATUTORY LIMITS (`§ 2026 statutory limits`) — facts with a citation.
 *      Wrong values here are factual errors. They change annually.
 *   2. APP DEFAULTS (`§ App defaults`) — our assumptions. Every one of these is
 *      user-adjustable and must be labelled in the UI as an assumption, not a
 *      fact. Wrong values here are editorial judgments, not bugs.
 *
 * All money is whole dollars; all rates are decimals.
 */

import type { FundingStage } from './types.ts';

// ===========================================================================
// § 2026 statutory limits
// ===========================================================================

// --- Retirement -----------------------------------------------------------

/**
 * Employee elective deferral limit for 401(k)/403(b)/most 457 plans, 2026.
 * Dollars per year.
 * https://www.irs.gov/node/152316
 */
export const LIMIT_401K_ELECTIVE_DEFERRAL = 24_500;

/**
 * Traditional and Roth IRA contribution limit, 2026. Dollars per year.
 * https://www.irs.gov/node/152316
 */
export const LIMIT_IRA_CONTRIBUTION = 7_500;

/**
 * Total annual additions limit for a defined contribution plan under
 * IRC §415(c), 2026 — employee deferrals plus all employer contributions.
 * Dollars per year. Used to sanity-check employer match + profit sharing.
 * https://www.venable.com/insights/publications/2025/11/2026-irs-dollar-limits-on-benefits-contributions
 */
export const LIMIT_DEFINED_CONTRIBUTION_TOTAL = 72_000;

// --- HSA / HDHP -----------------------------------------------------------

/**
 * HSA contribution limit, 2026, self-only coverage. Dollars per year.
 * Combined employee + employer.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const LIMIT_HSA_SELF_ONLY = 4_400;

/**
 * HSA contribution limit, 2026, family coverage. Dollars per year.
 * Combined employee + employer.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const LIMIT_HSA_FAMILY = 8_750;

/**
 * Minimum annual deductible for a plan to qualify as an HDHP, 2026, self-only.
 * Dollars.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const HDHP_MIN_DEDUCTIBLE_SELF_ONLY = 1_700;

/**
 * Minimum annual deductible for a plan to qualify as an HDHP, 2026, family.
 * Dollars.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const HDHP_MIN_DEDUCTIBLE_FAMILY = 3_400;

/**
 * HDHP maximum out-of-pocket, 2026, self-only. Dollars.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const HDHP_OOP_MAX_SELF_ONLY = 8_500;

/**
 * HDHP maximum out-of-pocket, 2026, family. Dollars.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const HDHP_OOP_MAX_FAMILY = 17_000;

// --- FSA ------------------------------------------------------------------

/**
 * Health FSA employee salary-reduction limit, 2026. Dollars per year.
 *
 * Note what this is NOT: a ceiling on an employer FSA seed. It caps what the
 * EMPLOYEE may elect to defer; an employer non-elective contribution is not
 * subject to it. `health.ts` therefore does not clamp the seed against this
 * figure — no sourced employer ceiling has been found, and invariant 5 says an
 * unsourced figure is not a constant to apply.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const LIMIT_HEALTH_FSA = 3_400;

/**
 * Dependent care FSA exclusion limit, 2026. Dollars per year.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const LIMIT_DEPENDENT_CARE_FSA = 7_500;

/**
 * Dependent care FSA exclusion limit, 2026, married filing separately.
 * Dollars per year.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const LIMIT_DEPENDENT_CARE_FSA_MFS = 3_750;

// --- Fringe benefits ------------------------------------------------------

/**
 * Qualified transportation fringe benefit exclusion, 2026. Dollars per month,
 * applied separately to transit passes/vanpooling and to qualified parking.
 * https://www.benefitresource.com/resources/plan-limits/
 */
export const LIMIT_COMMUTER_MONTHLY = 340;

/**
 * Annual equivalent of the qualified transportation fringe, per category.
 * Dollars per year. Derived, not independently sourced.
 */
export const LIMIT_COMMUTER_ANNUAL = LIMIT_COMMUTER_MONTHLY * 12;

/**
 * IRC §127 educational assistance exclusion. Dollars per year of employer-paid
 * tuition that is excluded from income.
 * TODO: verify 2026 figure against a primary IRS source
 */
export const LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE = 5_250;

/**
 * IRC §79 group term life: coverage ceiling below which the employer-paid
 * premium is tax-free. Dollars of death benefit. Premium on coverage above this
 * is imputed income; v1 does not model the split (DESIGN.md §2.3 note 2).
 * TODO: verify 2026 figure against a primary IRS source
 */
export const LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE = 50_000;

// ===========================================================================
// § App defaults
//
// ASSUMPTIONS, NOT FACTS. Every value below is user-adjustable and must be
// labelled as an assumption wherever it is surfaced. Do not cite these.
// ===========================================================================

// --- Tax ------------------------------------------------------------------

/**
 * Default combined marginal rate (federal income + FICA + state + local),
 * decimal. ASSUMPTION — a mid-career US professional's plausible combined rate,
 * not a computed bracket. DESIGN.md §2.2.
 */
export const DEFAULT_TAX_RATE = 0.3;

/**
 * Preset combined-marginal-rate buttons, decimals. ASSUMPTION — round anchors
 * spanning lower / middle / higher earners, for one-click adjustment.
 */
export const TAX_RATE_PRESETS: readonly number[] = [0.22, 0.32, 0.42];

/**
 * Default gross-up rate for the `tax_deferred` bucket, decimal. ASSUMPTION, and
 * a deliberate one: 0 means face value. A 401(k) match is taxed as ordinary
 * income on withdrawal and is illiquid until 59½, so grossing it up like
 * `tax_free` overstates it (invariant 3).
 */
export const DEFAULT_DEFERRED_RATE = 0;

/**
 * Hard ceiling on any rate used as a gross-up divisor, decimal. ASSUMPTION, and
 * a guard rather than a tax fact: `value / (1 - t)` explodes as `t` approaches
 * 1 and inverts above it, so a stray `1.3` from a restored save would turn a
 * $14,000 health premium into a negative number. 0.60 is above the highest
 * plausible US combined marginal rate (top federal + FICA + California), so
 * clamping here cannot silently truncate a real answer. A clamped rate always
 * emits a warning (`tax.ts`) rather than being applied quietly.
 */
export const MAX_TAX_RATE = 0.6;

// --- Hours and time off ---------------------------------------------------

/** Default hours per working week. ASSUMPTION. */
export const DEFAULT_HOURS_PER_WEEK = 40;

/** Default working days per week. ASSUMPTION. */
export const DEFAULT_DAYS_PER_WEEK = 5;

/** Default company holidays, days per year. ASSUMPTION. */
export const DEFAULT_HOLIDAY_DAYS = 11;

/** Default PTO for an accrual plan, days per year. ASSUMPTION. */
export const DEFAULT_PTO_DAYS = 15;

/**
 * Default days actually taken under an unlimited PTO plan, per year.
 * ASSUMPTION. Deliberately equal to `DEFAULT_PTO_DAYS`: the popular claim that
 * unlimited-PTO employees take meaningfully fewer days is not well supported,
 * and the app must not assert it (DESIGN.md §2.1).
 */
export const DEFAULT_UNLIMITED_PTO_EXPECTED_DAYS = 15;

/**
 * The naive annual hours everyone divides by — 40 × 52. Dollars-per-hour
 * denominator for `baseHourlyNaive` only. This is the anchor the user arrives
 * believing; it is never the real denominator.
 */
export const NAIVE_ANNUAL_HOURS = 2080;

/**
 * Hours per week above which the engine warns that the headline treats every
 * one of those hours as compensated (DESIGN.md §2.5). ASSUMPTION — a round
 * threshold a little above a standard week, not a legal or medical finding.
 */
export const WARN_HOURS_PER_WEEK_THRESHOLD = 50;

/** Weeks in a year. Used to convert day counts into weeks off. */
export const WEEKS_PER_YEAR = 52;

/**
 * Share of `totals.faceValue` above which a single `estimated` line item earns
 * a warning, decimal (DESIGN.md §2.5). ASSUMPTION — a round threshold, not a
 * statistical finding. The point it encodes: a guess worth 2% of the package is
 * noise, and a guess worth 30% means the headline is mostly a guess, and the
 * user is entitled to be told which situation they are in.
 */
export const WARN_ESTIMATED_SHARE_THRESHOLD = 0.1;

// --- Perks ----------------------------------------------------------------

/**
 * Default value of one free meal, dollars per day worked. ASSUMPTION — a
 * plausible lunch cost, not a surveyed figure. Off by default.
 */
export const DEFAULT_MEAL_VALUE = 15;

// --- Equity ---------------------------------------------------------------

/** Default vesting period, years. ASSUMPTION — the common tech grant shape. */
export const DEFAULT_VEST_YEARS = 4;

/**
 * Floor on the vesting period used as a divisor, years. ASSUMPTION, and a guard
 * rather than a grant fact: `grantValue / vestYears` divides by zero at 0, and a
 * restored save or a half-filled form can hold one. A year is the shortest
 * window over which "per year" means anything, and it attributes the whole grant
 * to year one — which is what actually happens when a grant vests immediately.
 * Mirrors `MIN_TENURE_YEARS` in `cash.ts`.
 */
export const MIN_VEST_YEARS = 1;

/**
 * Default common-vs-preferred haircut, decimal. ASSUMPTION. Common stock lacks
 * the liquidation preference and protective provisions preferred carries, so it
 * is worth materially less than the headline round price.
 */
export const DEFAULT_COMMON_DISCOUNT = 0.3;

/**
 * Default expected future dilution before exit, decimal. ASSUMPTION — later
 * rounds issue new shares and shrink an existing holder's percentage.
 */
export const DEFAULT_EXPECTED_DILUTION = 0.25;

/**
 * Multiple on the last round's valuation used for the `strong` scenario.
 * ASSUMPTION — a good-but-not-extraordinary outcome.
 */
export const DEFAULT_STRONG_MULTIPLE = 3;

/**
 * Probability of any liquidity event by funding stage at the time of the grant,
 * decimal.
 *
 * SOURCED, not invented — which makes this the one block in the "App defaults"
 * section that is not purely an assumption. The figures come from a study of
 * startup exit outcomes by funding stage: later-stage companies have already
 * survived the filters that kill earlier ones, so the observed exit rate climbs
 * monotonically.
 *
 * Still not a statutory fact, which is why it lives here rather than above:
 * it is a secondary source summarizing an empirical distribution, the
 * underlying population is not fully specified, and "exit" is doing some work
 * (an acqui-hire and a tenfold IPO are both exits, and only one of them makes
 * an option grant worth anything). Treat it as a better-grounded default than a
 * round number, not as a prediction about any particular company. Every value
 * stays user-overridable via `PrivateEquity.liquidityProbability`.
 *
 * https://www.zabella.net/blog/startup-exit-statistics
 * TODO: find the primary dataset behind this summary and cite it directly
 */
export const LIQUIDITY_PROBABILITY_BY_STAGE: Readonly<Record<FundingStage, number>> = {
  seed: 0.13,
  series_a: 0.19,
  series_b: 0.25,
  series_c: 0.33,
  series_d_plus: 0.39,
};

/**
 * Fallback probability of a liquidity event when the user has not told us what
 * stage the company is at, decimal. ASSUMPTION.
 *
 * 0.20 rather than the midpoint of the table above, because **most startups
 * fail.** Earlier-stage companies carry materially higher risk, and the base
 * rate across all startups sits nearer the bottom of that table than its
 * middle. With the stage unknown, the defensible default is the conservative
 * one: it sits between the seed and Series B figures, so it is wrong in a
 * knowable direction rather than flattering by default.
 *
 * This is a statement about startup survival, not about which users answer the
 * stage question. Overstating the probability makes a worthless grant look like
 * compensation, which is the error this app exists to correct; understating it
 * makes the headline a floor, which is the error it can live with.
 */
export const DEFAULT_LIQUIDITY_PROBABILITY = 0.2;

// --- ESPP -----------------------------------------------------------------

/**
 * Default ESPP purchase discount, decimal. ASSUMPTION — 15% is the statutory
 * maximum discount for a §423 qualified plan and the common design, but a given
 * plan may offer less.
 */
export const DEFAULT_ESPP_DISCOUNT = 0.15;

/**
 * Hard ceiling on the ESPP discount used as a gross-up divisor, decimal.
 * ASSUMPTION, and a guard rather than a plan fact: the discount value is
 * `contribution × d / (1 - d)`, which divides by zero at `d = 1` and inverts
 * above it. §423 caps a qualified plan at 0.15, so 0.50 cannot truncate a real
 * plan — it only stops a restored save from producing a negative benefit.
 */
export const MAX_ESPP_DISCOUNT = 0.5;
