/**
 * The orchestrator — the engine's only public export (CLAUDE.md "Layout").
 *
 * Pure by contract (invariant 1): same input, same output, always. No clock, no
 * randomness, no I/O, no side effects. If a future version needs "today", the
 * date becomes a field on `CompensationInput`; it is never read ambiently.
 * `__tests__/purity.test.ts` enforces this — fix the engine, not the test.
 *
 * Session 2 implements hours, cash, and the tax gross-up. Equity, retirement,
 * health, insurance, perks, and leave contribute nothing yet and the result
 * says so in a warning rather than quietly reporting a low number as finished.
 */

import { computeCashItems } from './cash.ts';
import { NAIVE_ANNUAL_HOURS, WARN_HOURS_PER_WEEK_THRESHOLD } from './constants.ts';
import { computeHours } from './hours.ts';
import { nonNegative } from './numbers.ts';
import { applyGrossUp, taxWarnings } from './tax.ts';
import type { CompensationInput, LineItem, TrueHourlyResult, Warning } from './types.ts';

/**
 * Warnings that depend on the denominator (DESIGN.md §2.5).
 * Takes the computed breakdown, not the raw input, so a warning can never
 * disagree with the number shown next to it.
 */
function hoursWarnings(hours: TrueHourlyResult['hours']): Warning[] {
  const warnings: Warning[] = [];

  if (hours.hoursWorked <= 0) {
    warnings.push({
      id: 'no-hours-worked',
      severity: 'caution',
      message:
        'Your time off adds up to the whole year, so there are no hours to divide by. ' +
        'The hourly figures are shown as $0 rather than as an error.',
    });
  }

  if (hours.hoursPerWeek > WARN_HOURS_PER_WEEK_THRESHOLD) {
    warnings.push({
      id: 'long-hours',
      severity: 'caution',
      message:
        `At ${hours.hoursPerWeek} hours a week, the headline treats all of those hours ` +
        'as compensated. If the extra hours are unpaid, your true hourly rate is lower ' +
        'than the same package would pay at 40 hours.',
    });
  }

  if (hours.overridden) {
    warnings.push({
      id: 'hours-overridden',
      severity: 'info',
      message:
        `You set annual hours worked directly (${hours.hoursWorked}), so PTO and holidays ` +
        'are not being used to derive the denominator.',
    });
  }

  return warnings;
}

/** The unlimited-PTO separation note (DESIGN.md §2.1, §2.6). */
function ptoWarnings(input: CompensationInput): Warning[] {
  if (input.hours.ptoPlan.type !== 'unlimited') return [];

  return [
    {
      id: 'unlimited-pto-no-payout',
      severity: 'info',
      message:
        'Unlimited PTO carries no accrued balance, so there is nothing to pay out when you ' +
        'leave. An accrual plan with the same days taken is worth more at separation.',
    },
  ];
}

/**
 * Cash-shape warnings (DESIGN.md §2.5).
 *
 * The clawback trigger fires when the clawback OUTLASTS the tenure the user
 * expects — not the other way round. A clawback that expires before the
 * amortization window closes is the benign case: the money goes unconditional
 * early and the only consequence is that the amortized figure is conservative.
 * The risk is a clawback still running at the point the user plans to leave,
 * because then the headline is counting dollars they may have to repay.
 */
function cashWarnings(input: CompensationInput): Warning[] {
  const { signOnBonus, signOnClawbackMonths, expectedTenureYears } = input.cash;
  const amortizationMonths = nonNegative(expectedTenureYears) * 12;

  if (signOnBonus <= 0 || signOnClawbackMonths <= 0) return [];
  if (signOnClawbackMonths <= amortizationMonths) return [];

  return [
    {
      id: 'sign-on-clawback-outlasts-tenure',
      severity: 'caution',
      message:
        `Your sign-on clawback runs for ${signOnClawbackMonths} months, longer than the ` +
        `${expectedTenureYears} years you expect to stay. If you leave while it is still in ` +
        'force you would repay some or all of the bonus, so the figures above count money ' +
        'that is not yet unconditionally yours.',
    },
  ];
}

export function calculate(input: CompensationInput): TrueHourlyResult {
  const hours = computeHours(input.hours);

  // Only cash contributes so far. Sessions 3-4 add their drafts to this array;
  // nothing downstream of here needs to change when they do.
  const drafts = [...computeCashItems(input.cash)];

  const lineItems: LineItem[] = drafts.map((draft) => applyGrossUp(draft, input.tax));

  const totals = lineItems.reduce(
    (acc, item) => ({
      faceValue: acc.faceValue + item.annualValue,
      salaryEquivalent: acc.salaryEquivalent + item.salaryEquivalent,
    }),
    { faceValue: 0, salaryEquivalent: 0 }
  );

  // Invariant 4: both headline figures are always computed, and the engine
  // never decides which the UI shows. `hoursWorked` of 0 yields 0, not
  // Infinity — the warning above explains why (Fixture C).
  const perHour = (total: number): number =>
    hours.hoursWorked > 0 ? total / hours.hoursWorked : 0;

  return {
    hours,
    lineItems,
    totals,
    trueHourly: {
      faceValue: perHour(totals.faceValue),
      salaryEquivalent: perHour(totals.salaryEquivalent),
    },
    baseHourlyNaive: nonNegative(input.cash.baseSalary) / NAIVE_ANNUAL_HOURS,
    warnings: [
      ...hoursWarnings(hours),
      ...cashWarnings(input),
      ...ptoWarnings(input),
      ...taxWarnings(input.tax),
      {
        id: 'engine-partial',
        severity: 'caution',
        message:
          'Only hours, salary, bonus and sign-on are counted so far. Equity, retirement, ' +
          'health, insurance, perks and leave are not yet included, so these totals are low.',
      },
    ],
  };
}
