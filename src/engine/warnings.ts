/**
 * The warning catalogue (DESIGN.md §2.5).
 *
 * Why this module exists. Sessions 2 and 3 grew warnings wherever they happened
 * to be noticed: three private helpers in `calculate.ts`, one exported function
 * in `tax.ts`, and inline object literals in `retirement.ts`, `health.ts` and
 * `perks.ts`. Nothing was wrong with any of them individually, but there was no
 * single place to answer "what can this app tell the user?", and two modules
 * were one copy-paste away from emitting the same id with different wording.
 *
 * So: **every warning id and message in the engine is constructed here.** The
 * UI decides presentation; the engine decides what is true and says it once.
 *
 * ── What did NOT move here, and why ─────────────────────────────────────
 *
 * Detection stays where the facts are. A statutory clamp is only observable
 * inside the module that clamped — that is the entire reason `ContributionSet`
 * exists (see `types.ts`). Pulling the trigger for `annual-additions-limit-
 * clamped` into this file would mean re-deriving "did the §415(c) limit bind?"
 * in a second pass that could disagree with the first, and would make this
 * module import `retirement.ts` while `retirement.ts` imports this one.
 *
 * The split is therefore: this file owns the *catalogue* (ids, severities,
 * wording); each contributor module owns the *trigger* for conditions only it
 * can see, and hands the resulting `Warning[]` back through its
 * `ContributionSet`. Warnings that depend on nothing but the input, or on the
 * finished result, are aggregated here by `inputWarnings` and
 * `compositionWarnings`.
 */

import {
  LIMIT_COMMUTER_MONTHLY,
  LIMIT_DEFINED_CONTRIBUTION_TOTAL,
  LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE,
  WARN_ESTIMATED_SHARE_THRESHOLD,
  WARN_HOURS_PER_WEEK_THRESHOLD,
} from './constants.ts';
import { nonNegative } from './numbers.ts';
import { clampRate } from './tax.ts';
import type {
  CompensationInput,
  HealthInput,
  HoursBreakdown,
  LineItem,
  TaxInput,
  TrueHourlyResult,
  Warning,
} from './types.ts';

/** Whole dollars with thousands separators, for warning prose only. */
function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

// ---------------------------------------------------------------------------
// Hours and time off (DESIGN.md §2.1, §2.5)
// ---------------------------------------------------------------------------

export function noHoursWorked(): Warning {
  return {
    id: 'no-hours-worked',
    severity: 'caution',
    message:
      'Your time off adds up to the whole year, so there are no hours to divide by. ' +
      'The hourly figures are shown as $0 rather than as an error.',
  };
}

export function longHours(hoursPerWeek: number): Warning {
  return {
    id: 'long-hours',
    severity: 'caution',
    message:
      `At ${hoursPerWeek} hours a week, the headline treats all of those hours ` +
      'as compensated. If the extra hours are unpaid, your true hourly rate is lower ' +
      'than the same package would pay at 40 hours.',
  };
}

export function hoursOverridden(hoursWorked: number): Warning {
  return {
    id: 'hours-overridden',
    severity: 'info',
    message:
      `You set annual hours worked directly (${hoursWorked}), so PTO and holidays ` +
      'are not being used to derive the denominator.',
  };
}

export function unlimitedPtoNoPayout(): Warning {
  return {
    id: 'unlimited-pto-no-payout',
    severity: 'info',
    message:
      'Unlimited PTO carries no accrued balance, so there is nothing to pay out when you ' +
      'leave. An accrual plan with the same days taken is worth more at separation.',
  };
}

// ---------------------------------------------------------------------------
// Cash (DESIGN.md §2.5)
// ---------------------------------------------------------------------------

export function signOnClawbackOutlastsTenure(clawbackMonths: number, tenureYears: number): Warning {
  return {
    id: 'sign-on-clawback-outlasts-tenure',
    severity: 'caution',
    message:
      `Your sign-on clawback runs for ${clawbackMonths} months, longer than the ` +
      `${tenureYears} years you expect to stay. If you leave while it is still in ` +
      'force you would repay some or all of the bonus, so the figures above count money ' +
      'that is not yet unconditionally yours.',
  };
}

// ---------------------------------------------------------------------------
// Tax assumption (DESIGN.md §2.2)
// ---------------------------------------------------------------------------

export function taxRateClamped(appliedRate: number): Warning {
  return {
    id: 'tax-rate-clamped',
    severity: 'caution',
    message:
      `Your combined marginal rate was outside the usable range and has been ` +
      `treated as ${(appliedRate * 100).toFixed(0)}%. ` +
      `Rates at or above 100% make the salary-equivalent figure meaningless.`,
  };
}

export function deferredRateClamped(appliedRate: number): Warning {
  return {
    id: 'deferred-rate-clamped',
    severity: 'caution',
    message:
      `Your tax-deferred rate was outside the usable range and has been ` +
      `treated as ${(appliedRate * 100).toFixed(0)}%.`,
  };
}

export function deferredRateRaised(): Warning {
  return {
    id: 'deferred-rate-raised',
    severity: 'info',
    message:
      `You are grossing up tax-deferred money. Employer 401(k) contributions ` +
      `escape payroll tax permanently, but they are taxed as ordinary income on ` +
      `withdrawal and are not accessible without penalty until age 59.5 — so ` +
      `they are worth less per dollar than a tax-free benefit.`,
  };
}

// ---------------------------------------------------------------------------
// Retirement — triggered in `retirement.ts`
// ---------------------------------------------------------------------------

export function annualAdditionsLimitClamped(): Warning {
  return {
    id: 'annual-additions-limit-clamped',
    severity: 'caution',
    message:
      `Employer retirement contributions came to more than the ${money(LIMIT_DEFINED_CONTRIBUTION_TOTAL)} ` +
      'IRS annual additions limit for 2026, so they have been scaled back proportionally to fit. ' +
      'The limit also counts your own 401(k) contributions, which this app does not ask for, ' +
      'so your real headroom is smaller than this.',
  };
}

/** DESIGN.md §2.5: "401(k) match entered but a vesting cliff also entered". */
export function matchVestingCliff(matchAmount: number, vestingYears: number): Warning {
  return {
    id: 'match-vesting-cliff',
    severity: 'caution',
    message:
      `The ${money(matchAmount)} employer match takes ${vestingYears} ` +
      `year${vestingYears === 1 ? '' : 's'} to vest. Until then it is not yours: leaving early ` +
      'forfeits some or all of it, so the headline counts money you may never keep. Your own ' +
      'contributions are always 100% yours — this applies only to the employer’s.',
  };
}

// ---------------------------------------------------------------------------
// Health — triggered in `health.ts`
// ---------------------------------------------------------------------------

export function hsaContributionClamped(
  coverageTier: HealthInput['coverageTier'],
  limit: number
): Warning {
  return {
    id: 'hsa-contribution-clamped',
    severity: 'caution',
    message:
      `The employer HSA contribution you entered is above the 2026 ${coverageTier === 'family' ? 'family' : 'self-only'} ` +
      `HSA limit of ${money(limit)}, so it has been capped at the limit. ` +
      'That limit covers your own contributions as well as your employer’s, so the room ' +
      'left for you is smaller still.',
  };
}

// ---------------------------------------------------------------------------
// Perks — triggered in `perks.ts`
// ---------------------------------------------------------------------------

export function commuterBenefitClamped(): Warning {
  return {
    id: 'commuter-benefit-clamped',
    severity: 'caution',
    message:
      `The qualified transportation exclusion is $${LIMIT_COMMUTER_MONTHLY} a month in 2026, so your ` +
      'commuter benefit has been capped at that. Anything your employer gives you above the ' +
      'limit is taxable wages rather than a tax-free benefit.',
  };
}

export function tuitionReimbursementClamped(): Warning {
  return {
    id: 'tuition-reimbursement-clamped',
    severity: 'caution',
    message:
      `IRC §127 excludes up to ${money(LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE)} of employer education ` +
      'assistance a year, so the tax-free part has been capped there. The rest is still real ' +
      'money — it is just taxable wages, so it is not counted as a tax-free benefit here.',
  };
}

// ---------------------------------------------------------------------------
// Equity — triggered in `equity.ts` (DESIGN.md §2.4, §2.5)
// ---------------------------------------------------------------------------

export function equityUnknown(): Warning {
  return {
    id: 'equity-unknown',
    severity: 'caution',
    message:
      'You have equity but no value for it, so it is counted as $0 — the headline below is a ' +
      'floor, not an estimate. If it is private-company stock, the private estimator will give ' +
      'you a range with its assumptions shown instead of a single number nobody can justify.',
  };
}

export function privateEquityHeadlineZero(modestPerYear: number): Warning {
  return {
    id: 'private-equity-headline-zero',
    severity: 'info',
    message:
      'Private-company equity is counted as $0 in the headline on purpose: most startup equity ' +
      `ends up worth nothing, and a confident number here would be a guess dressed as a fact. ` +
      `The scenario range beside it — ${money(modestPerYear)} a year if the company exits near its last ` +
      'round — is where that value is shown, with every assumption listed.',
  };
}

export function equityCliffContingent(cliffMonths: number): Warning {
  return {
    id: 'equity-cliff-contingent',
    severity: 'caution',
    message:
      `Your grant has a ${cliffMonths}-month cliff, so none of it is yours until then. The ` +
      'per-year figure above spreads the grant evenly across the vesting period, which means ' +
      'it counts value you would forfeit entirely by leaving before the cliff.',
  };
}

export function equityInitialGrantNotSteadyState(vestYears: number): Warning {
  return {
    id: 'equity-initial-grant-not-steady-state',
    severity: 'info',
    message:
      `This is one grant spread over ${vestYears} year${vestYears === 1 ? '' : 's'}. Year 1 and ` +
      'year 5 are not the same job: without refresher grants the equity income stops when this ' +
      'grant finishes vesting, and with them it can be higher. Ask what refreshers look like ' +
      'before treating this as a steady annual rate.',
  };
}

export function optionsUnderwater(fairMarketValue: number, strikePrice: number): Warning {
  return {
    id: 'options-underwater',
    severity: 'caution',
    message:
      `Your strike price of ${money(strikePrice)} is above the current fair market value of ` +
      `${money(fairMarketValue)}, so these options are underwater and are counted as $0. They are ` +
      'not worthless — they regain value if the share price rises above the strike — but today ' +
      'exercising them would cost more than the shares are worth.',
  };
}

export function optionsExerciseCost(exerciseCost: number, grantShares: number): Warning {
  return {
    id: 'options-exercise-cost',
    severity: 'caution',
    message:
      `Options are not shares. Turning all ${Math.round(grantShares).toLocaleString('en-US')} of ` +
      `them into stock costs ${money(exerciseCost)} of your own money at the strike price, and the ` +
      'figure above does not subtract that. A grant you cannot afford to exercise is worth less ' +
      'than its intrinsic value suggests.',
  };
}

export function isoAmtExposure(): Warning {
  return {
    id: 'iso-amt-exposure',
    severity: 'caution',
    message:
      'Exercising an ISO and holding the shares adds the spread to your alternative minimum tax ' +
      'income, so a year with no cash proceeds can still produce a tax bill. This app does not ' +
      'model AMT — treat it as a reason to get advice before a large exercise.',
  };
}

// ---------------------------------------------------------------------------
// Cross-cutting: warnings about the finished result
// ---------------------------------------------------------------------------

/**
 * Nothing has been entered yet (DESIGN.md §4, Fixture C).
 *
 * The fixture requires a degenerate input to return `trueHourly` of 0 "with a
 * warning", and through sessions 2 and 3 that requirement was being met by
 * accident: `engine-partial` happened to fire on every result, including an
 * empty one. Removing it when equity landed exposed the gap, which is a fair
 * description of why Fixture C is in DESIGN.md at all.
 *
 * This is the right warning for the case regardless. An empty form is the app's
 * first-load state, and $0.00 an hour with no explanation reads as a broken
 * calculator rather than an unanswered question. Note what it is NOT: a
 * `no-hours-worked` warning. The denominator here is a perfectly good 1,872
 * hours — it is the numerator that is empty.
 */
export function noCompensationEntered(): Warning {
  return {
    id: 'no-compensation-entered',
    severity: 'info',
    message:
      'No compensation has been entered yet, so every figure below is $0. Start with base ' +
      'salary — that alone gives you the naive hourly rate this app exists to correct.',
  };
}

/**
 * DESIGN.md §2.5: "any `estimated` line item contributing more than 10% of
 * total comp".
 *
 * One warning naming every offender rather than one per item: the id has to
 * stay stable for the UI, and duplicate ids in a list the UI renders by key is
 * a bug waiting to happen. In practice there is rarely more than one.
 */
export function largeEstimatedLineItems(items: readonly LineItem[], faceTotal: number): Warning {
  const share = (item: LineItem): string => `${((item.annualValue / faceTotal) * 100).toFixed(0)}%`;
  const named = items.map((item) => `${item.label} (${money(item.annualValue)}, ${share(item)})`);

  return {
    id: 'large-estimated-line-item',
    severity: 'caution',
    message:
      `${named.length === 1 ? 'An estimate makes' : 'Estimates make'} up a large share of this ` +
      `package: ${named.join('; ')}. ${named.length === 1 ? 'That figure is' : 'Those figures are'} ` +
      'not something you entered, so the headline is only as good as the assumption behind ' +
      `${named.length === 1 ? 'it' : 'them'}.`,
  };
}

// ---------------------------------------------------------------------------
// Aggregators
// ---------------------------------------------------------------------------

/**
 * Warnings that depend on the denominator.
 *
 * Takes the computed breakdown, not the raw input, so a warning can never
 * disagree with the number shown next to it.
 */
export function hoursWarnings(hours: HoursBreakdown): Warning[] {
  const warnings: Warning[] = [];
  if (hours.hoursWorked <= 0) warnings.push(noHoursWorked());
  if (hours.hoursPerWeek > WARN_HOURS_PER_WEEK_THRESHOLD)
    warnings.push(longHours(hours.hoursPerWeek));
  if (hours.overridden) warnings.push(hoursOverridden(hours.hoursWorked));
  return warnings;
}

/**
 * Cash-shape warnings.
 *
 * The clawback trigger fires when the clawback OUTLASTS the tenure the user
 * expects — not the other way round. A clawback that expires before the
 * amortization window closes is the benign case: the money goes unconditional
 * early and the only consequence is that the amortized figure is conservative.
 * The risk is a clawback still running at the point the user plans to leave,
 * because then the headline is counting dollars they may have to repay.
 */
export function cashWarnings(cash: CompensationInput['cash']): Warning[] {
  const { signOnBonus, signOnClawbackMonths, expectedTenureYears } = cash;
  const amortizationMonths = nonNegative(expectedTenureYears) * 12;

  if (signOnBonus <= 0 || signOnClawbackMonths <= 0) return [];
  if (signOnClawbackMonths <= amortizationMonths) return [];
  return [signOnClawbackOutlastsTenure(signOnClawbackMonths, expectedTenureYears)];
}

/**
 * Warnings about the tax assumption itself.
 *
 * A clamped rate must never be applied silently: the user typed a number and
 * the engine used a different one, and invariant 6 says the app never presents
 * a guess as a fact.
 */
export function taxWarnings(tax: TaxInput): Warning[] {
  const warnings: Warning[] = [];

  if (clampRate(tax.combinedMarginalRate) !== tax.combinedMarginalRate) {
    warnings.push(taxRateClamped(clampRate(tax.combinedMarginalRate)));
  }
  if (clampRate(tax.deferredRate) !== tax.deferredRate) {
    warnings.push(deferredRateClamped(clampRate(tax.deferredRate)));
  }
  if (clampRate(tax.deferredRate) > 0) warnings.push(deferredRateRaised());

  return warnings;
}

/** Every warning derivable from the input and the denominator alone. */
export function inputWarnings(input: CompensationInput, hours: HoursBreakdown): Warning[] {
  return [
    ...hoursWarnings(hours),
    ...cashWarnings(input.cash),
    ...(input.hours.ptoPlan.type === 'unlimited' ? [unlimitedPtoNoPayout()] : []),
    ...taxWarnings(input.tax),
  ];
}

/**
 * Warnings that can only be judged once every line item exists, because they
 * are about proportions rather than about any one input.
 */
export function compositionWarnings(
  lineItems: readonly LineItem[],
  totals: TrueHourlyResult['totals']
): Warning[] {
  // An empty numerator cannot have a 10%-of-total item in it, and the share
  // arithmetic below would divide by zero trying to find one.
  if (totals.faceValue <= 0) return [noCompensationEntered()];

  const large = lineItems.filter(
    (item) =>
      item.confidence === 'estimated' &&
      item.annualValue / totals.faceValue > WARN_ESTIMATED_SHARE_THRESHOLD
  );

  return large.length > 0 ? [largeEstimatedLineItems(large, totals.faceValue)] : [];
}
