/**
 * The denominator: hours actually worked in a year (DESIGN.md §2.1).
 *
 *     weeksOff    = (ptoDays + holidayDays + unpaidLeaveDays) / daysPerWeek
 *                   + sabbaticalWeeks / sabbaticalCycleYears
 *     hoursWorked = hoursPerWeek x (52 - weeksOff)
 *     daysWorked  = (52 - weeksOff) x daysPerWeek
 *
 * This file is the whole of CLAUDE.md invariant 2. Paid time off is not
 * additive compensation for a salaried worker — the salary is the same whether
 * they take 5 days or 25 — so its value appears here, as fewer hours for the
 * same money, and nowhere else. There is no PTO line item, and adding one while
 * also dividing by 2080 would double-count it.
 *
 * A **paid sabbatical** is the same thing one step out: full salary for a block
 * of weeks not worked. It therefore belongs here too, amortized over its cycle
 * (6 weeks every 5 years is 1.2 weeks off every year), and it has no line item.
 * Earlier drafts of DESIGN.md §2.3 listed it as `taxable` in the numerator; that
 * was the double-count this invariant exists to prevent, and it was corrected.
 */

import { WEEKS_PER_YEAR } from './constants.ts';
import { clamp, nonNegative } from './numbers.ts';
import type { HoursBreakdown, HoursInput, PtoPlan } from './types.ts';

/**
 * Working days per week must be at least 1 (a zero would make `weeksOff`
 * infinite) and at most 7. The denominator math is incoherent outside that.
 */
const MIN_DAYS_PER_WEEK = 1;
const MAX_DAYS_PER_WEEK = 7;

/**
 * Days of PTO for the denominator, whichever plan the user is on.
 *
 * The two variants hold semantically different numbers — days *granted* under
 * an accrual plan, days the user expects to *take* under an unlimited plan —
 * but DESIGN.md §2.1 is explicit that the denominator needs no special case:
 * both are days not worked. What the plan type changes is the separation payout
 * (§2.6), which is an off-headline note, not a line item.
 */
export function ptoDaysOf(plan: PtoPlan): number {
  return nonNegative(plan.type === 'accrual' ? plan.ptoDays : plan.expectedDaysTaken);
}

/**
 * Compute the full, auditable denominator.
 *
 * Guarantees, relied on by every caller:
 *   - every field is finite; never `NaN`, never `Infinity` (Fixture C)
 *   - `hoursWorked` and `daysWorked` are never negative. If time off exceeds
 *     the year, both are 0 and the CALLER emits the warning — this function
 *     reports what it computed and does not editorialize.
 *
 * A caller must therefore treat `hoursWorked === 0` as "cannot divide" rather
 * than dividing and checking for `Infinity` afterwards.
 */
export function computeHours(input: HoursInput): HoursBreakdown {
  const hoursPerWeek = nonNegative(input.hoursPerWeek);
  const daysPerWeek = clamp(input.daysPerWeek, MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK);

  const ptoDays = ptoDaysOf(input.ptoPlan);
  const holidayDays = nonNegative(input.holidayDays);
  const unpaidLeaveDays = nonNegative(input.unpaidLeaveDays);

  // Amortized to a yearly rate. A cycle of 0 means no sabbatical rather than a
  // division by zero — the guard is here and not at the input boundary because
  // a restored save can hold weeks with no cycle.
  const sabbaticalWeeks = nonNegative(input.sabbaticalWeeks);
  const sabbaticalCycleYears = nonNegative(input.sabbaticalCycleYears);
  const sabbaticalWeeksPerYear =
    sabbaticalCycleYears > 0 ? sabbaticalWeeks / sabbaticalCycleYears : 0;

  const weeksOff = (ptoDays + holidayDays + unpaidLeaveDays) / daysPerWeek + sabbaticalWeeksPerYear;

  // Clamped at 0, not allowed to go negative: more time off than there is year
  // is a data-entry error, and a negative denominator would produce a negative
  // hourly rate that looks like a calculation the app meant.
  const weeksWorked = Math.max(WEEKS_PER_YEAR - weeksOff, 0);

  const derivedHoursWorked = hoursPerWeek * weeksWorked;
  const overridden = input.hoursWorkedOverride !== null;

  return {
    hoursPerWeek,
    daysPerWeek,
    ptoDays,
    holidayDays,
    unpaidLeaveDays,
    sabbaticalWeeksPerYear,
    hoursWorked: overridden
      ? nonNegative(input.hoursWorkedOverride ?? 0)
      : nonNegative(derivedHoursWorked),
    // Deliberately still derived from the time-off inputs even when the user
    // overrode `hoursWorked`. The override is a statement about hours, and
    // `daysWorked` drives per-day perks such as free meals (DESIGN.md §2.3);
    // there is no defensible way to infer a day count from an hours slider.
    daysWorked: nonNegative(weeksWorked * daysPerWeek),
    overridden,
  };
}
