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
      'Your time off covers the whole year, so there are no hours to divide by. Hourly figures show as $0.',
  };
}

export function longHours(hoursPerWeek: number): Warning {
  return {
    id: 'long-hours',
    severity: 'caution',
    message: `At ${hoursPerWeek} hours a week, your pay is spread over more hours than a standard 40, which lowers your hourly rate.`,
  };
}

export function hoursOverridden(hoursWorked: number): Warning {
  return {
    id: 'hours-overridden',
    severity: 'info',
    message: `You set annual hours directly (${hoursWorked}), so PTO and holidays are ignored.`,
  };
}

export function unlimitedPtoNoPayout(): Warning {
  return {
    id: 'unlimited-pto-no-payout',
    severity: 'info',
    message:
      'Unlimited PTO has no balance, so nothing is paid out when you leave unlike an accrual plan.',
  };
}

// ---------------------------------------------------------------------------
// Cash (DESIGN.md §2.5)
// ---------------------------------------------------------------------------

export function signOnClawbackOutlastsTenure(clawbackMonths: number, tenureYears: number): Warning {
  return {
    id: 'sign-on-clawback-outlasts-tenure',
    severity: 'caution',
    message: `Your sign-on clawback lasts ${clawbackMonths} months, longer than the ${tenureYears} years you plan to stay. Leave early and you may have to pay some of it back.`,
  };
}

// ---------------------------------------------------------------------------
// Tax assumption (DESIGN.md §2.2)
// ---------------------------------------------------------------------------

export function taxRateClamped(appliedRate: number): Warning {
  return {
    id: 'tax-rate-clamped',
    severity: 'caution',
    message: `Your tax rate was out of range, so ${(appliedRate * 100).toFixed(0)}% was used instead.`,
  };
}

export function deferredRateClamped(appliedRate: number): Warning {
  return {
    id: 'deferred-rate-clamped',
    severity: 'caution',
    message: `Your tax-deferred rate was out of range, so ${(appliedRate * 100).toFixed(0)}% was used instead.`,
  };
}

export function deferredRateRaised(): Warning {
  return {
    id: 'deferred-rate-raised',
    severity: 'info',
    message:
      'You are grossing up 401(k) money. It is locked until 59½ and taxed when you withdraw it, so it is worth less per dollar than a tax-free benefit.',
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
      `Employer retirement contributions are over the ${money(LIMIT_DEFINED_CONTRIBUTION_TOTAL)} IRS limit for 2026, so they were scaled down to fit. ` +
      'The limit includes your own 401(k) contributions too, so your real room is smaller.',
  };
}

/** DESIGN.md §2.5: "401(k) match entered but a vesting cliff also entered". */
export function matchVestingCliff(matchAmount: number, vestingYears: number): Warning {
  return {
    id: 'match-vesting-cliff',
    severity: 'caution',
    message:
      `The ${money(matchAmount)} employer match takes ${vestingYears} year${vestingYears === 1 ? '' : 's'} to vest. ` +
      'Leave before then and you lose some or all of it. Your own contributions are always 100% yours.',
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
      `Your employer HSA contribution is over the 2026 ${coverageTier === 'family' ? 'family' : 'self-only'} limit of ${money(limit)}, so it was capped. ` +
      'That limit includes your own contributions too.',
  };
}

// ---------------------------------------------------------------------------
// Perks — triggered in `perks.ts`
// ---------------------------------------------------------------------------

export function commuterBenefitClamped(): Warning {
  return {
    id: 'commuter-benefit-clamped',
    severity: 'caution',
    message: `Commuter benefits are tax-free up to $${LIMIT_COMMUTER_MONTHLY} a month in 2026. Anything above that is taxable wages and is not counted here.`,
  };
}

export function tuitionReimbursementClamped(): Warning {
  return {
    id: 'tuition-reimbursement-clamped',
    severity: 'caution',
    message: `Education assistance is tax-free up to ${money(LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE)} a year. Anything above that is taxable wages and is not counted here.`,
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
      'Your equity has no value entered, so it counts as $0 and the headline is a floor. For private stock, use the private estimator to see a range.',
  };
}

export function privateEquityHeadlineZero(modestPerYear: number): Warning {
  return {
    id: 'private-equity-headline-zero',
    severity: 'info',
    message:
      'Private equity counts as $0 in the headline because most startup equity ends up worthless. ' +
      `If the company sells near its last round, it would be worth about ${money(modestPerYear)} a year.`,
  };
}

export function equityCliffContingent(cliffMonths: number): Warning {
  return {
    id: 'equity-cliff-contingent',
    severity: 'caution',
    message: `Your grant has a ${cliffMonths}-month cliff. Leave before then and you get none of it, even though the yearly figure counts it.`,
  };
}

export function equityInitialGrantNotSteadyState(vestYears: number): Warning {
  return {
    id: 'equity-initial-grant-not-steady-state',
    severity: 'info',
    message: `This grant vests over ${vestYears} year${vestYears === 1 ? '' : 's'}. Without refresher grants, equity income stops after that, so ask what refreshers look like.`,
  };
}

export function optionsUnderwater(fairMarketValue: number, strikePrice: number): Warning {
  return {
    id: 'options-underwater',
    severity: 'caution',
    message:
      `Your strike price (${money(strikePrice)}) is above the current value (${money(fairMarketValue)}), so these options are underwater and count as $0. ` +
      'They are not worthless: they regain value if the price rises above the strike.',
  };
}

export function optionsExerciseCost(exerciseCost: number, grantShares: number): Warning {
  return {
    id: 'options-exercise-cost',
    severity: 'caution',
    message: `Exercising all ${Math.round(grantShares).toLocaleString('en-US')} options costs ${money(exerciseCost)} of your own money, which the figure above does not subtract.`,
  };
}

export function isoAmtExposure(): Warning {
  return {
    id: 'iso-amt-exposure',
    severity: 'caution',
    message:
      'Exercising ISOs and holding the shares can trigger alternative minimum tax, even with no cash in hand. This app does not model AMT, so get advice before a large exercise.',
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
    message: 'Nothing entered yet. Start with your base salary.',
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
      `Estimated, not entered: ${named.join('; ')}. ` +
      `${named.length === 1 ? 'It is' : 'They are'} a large share of your package, so the headline depends on ${named.length === 1 ? 'that guess' : 'those guesses'}.`,
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
