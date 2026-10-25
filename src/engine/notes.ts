/**
 * Off-headline notes (DESIGN.md §2.6).
 *
 * Real but not per-hour. Every item in here is genuine compensation or a
 * genuine cost, and none of it divides sensibly by hours worked:
 *
 *   - A PTO payout at separation is paid **once, on leaving**. Annualizing it
 *     would turn a one-time asset into a recurring rate.
 *   - Severance, on-call load and the remote/in-office difference are facts
 *     about the job the app cannot price without inventing figures, which
 *     invariant 5 forbids. The honest move is to name them and let the user
 *     weigh them.
 *   - A vesting schedule and an equity cliff are *conditions* on money already
 *     counted in a line item, not extra money.
 *
 * **A note must never affect `totals` or `trueHourly`.** That is why these are a
 * separate array rather than `LineItem`s with a flag: a flag is something a
 * future summing loop can forget to check, and the first time it does, the
 * headline silently double-counts. `notes.test.ts` pins this directly.
 *
 * The invariant-2 parallel is worth stating. PTO's value is in the denominator;
 * its *payout* is an asset; neither is a line item. The accrual-vs-unlimited
 * distinction changes nothing about the hourly math and everything about this
 * card, which is exactly what DESIGN.md §2.1 says it should.
 */

import { WEEKS_PER_YEAR } from './constants.ts';
import { dollars, nonNegative } from './numbers.ts';
import type { CompensationInput, EquityInput, HoursBreakdown, Note } from './types.ts';

/**
 * Daily rate for valuing an accrued PTO balance: annual salary over scheduled
 * working days, `daysPerWeek × 52`.
 *
 * NOT `daysWorked`. A payout is computed by payroll against the days the
 * contract pays for, which includes the PTO and holidays themselves — dividing
 * by days actually worked would inflate the rate by exactly the time off, and
 * the balance being valued is denominated in those same days.
 */
export function dailyRateFor(baseSalary: number, hours: HoursBreakdown): number {
  const scheduledDays = nonNegative(hours.daysPerWeek) * WEEKS_PER_YEAR;
  return scheduledDays > 0 ? nonNegative(baseSalary) / scheduledDays : 0;
}

/** The cliff on whichever equity mode carries one; 0 when the mode has none. */
function cliffMonthsOf(equity: EquityInput): number {
  switch (equity.type) {
    case 'public':
    case 'private':
    case 'options':
      return nonNegative(equity.cliffMonths);
    case 'none':
    case 'unknown':
      return 0;
  }
}

/** PTO payout at separation (DESIGN.md §2.6) — the one note with a figure. */
function ptoSeparationNote(input: CompensationInput, hours: HoursBreakdown): Note {
  const plan = input.hours.ptoPlan;

  if (plan.type === 'unlimited') {
    return {
      id: 'pto-separation-payout',
      title: 'PTO payout at separation',
      body: 'Unlimited PTO has no balance, so there is nothing to pay out when you leave.',
      amount: 0,
      confidence: 'entered',
    };
  }

  const balanceDays = nonNegative(plan.expectedAccruedBalanceDays);
  const payout = dailyRateFor(input.cash.baseSalary, hours) * balanceDays;

  return {
    id: 'pto-separation-payout',
    title: 'PTO payout at separation',
    body:
      `${balanceDays} unused day${balanceDays === 1 ? '' : 's'} at ` +
      `$${Math.round(dailyRateFor(input.cash.baseSalary, hours)).toLocaleString('en-US')} a day, ` +
      'paid once when you leave.',
    amount: dollars(payout),
    // Estimated, not entered: the user gave a balance they EXPECT to hold, and
    // the daily rate is the app's own derivation from salary.
    confidence: 'estimated',
  };
}

/**
 * Every off-headline note for this input.
 *
 * Three of these are unconditional prompts rather than computed values. That is
 * deliberate: DESIGN.md §2.6 lists them as cards precisely because the app
 * cannot price them, and a card that only appears once the user has already
 * thought to enter something would never prompt anybody.
 */
export function computeNotes(input: CompensationInput, hours: HoursBreakdown): Note[] {
  const notes: Note[] = [ptoSeparationNote(input, hours)];

  const vestingYears = nonNegative(input.retirement.matchVestingYears);
  if (vestingYears > 0) {
    notes.push({
      id: 'retirement-vesting-schedule',
      title: '401(k) vesting schedule',
      body:
        `Employer contributions take ${vestingYears} year${vestingYears === 1 ? '' : 's'} to ` +
        'vest. Ask whether it is a cliff (all at once) or graded (a share each year).',
      confidence: 'entered',
    });
  }

  const cliffMonths = cliffMonthsOf(input.equity);
  if (cliffMonths > 0) {
    notes.push({
      id: 'equity-cliff',
      title: 'Equity cliff',
      body:
        `Nothing vests for ${Math.round(cliffMonths)} months. Leave or get let go before then ` +
        'and you lose the whole grant.',
      confidence: 'entered',
    });
  }

  notes.push({
    id: 'on-call-burden',
    title: 'On-call burden',
    body:
      'On-call time rarely shows up in hours per week. If it is unpaid, your real rate is ' +
      'lower. If it pays a stipend, add that as compensation.',
    confidence: 'unknown',
  });

  const commute = nonNegative(input.hours.commuteMinutesOneWay);
  notes.push({
    id: 'remote-vs-in-office',
    title: 'Remote vs in-office',
    body:
      (commute > 0
        ? `A ${Math.round(commute)}-minute commute each way is about ` +
          `${Math.round(((commute * 2) / 60) * hours.daysWorked)} hours a year, unpaid. `
        : '') + 'Commute time is left out of the headline so rates stay comparable across jobs.',
    confidence: commute > 0 ? 'entered' : 'unknown',
  });

  return notes;
}
