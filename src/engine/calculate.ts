import { NAIVE_ANNUAL_HOURS } from './constants.ts';
import type { CompensationInput, TrueHourlyResult } from './types.ts';

/**
 * The engine's only public export: a pure function from the full input object to
 * the full result object.
 *
 * STUB. Session 1 establishes the signature and the shape of a valid result;
 * the real calculation arrives in sessions 2-4 (DESIGN.md §7):
 *
 *   - session 2: hours denominator, cash line items, tax gross-up
 *   - session 3: retirement, health, perks
 *   - session 4: equity (all four modes) and warnings
 *
 * The returned result is deliberately zero-filled rather than partially computed,
 * so nothing downstream can mistake a stub for an answer. It satisfies Fixture C
 * (DESIGN.md §4) by construction: no `NaN`, no `Infinity`, no division by zero.
 *
 * Purity (invariant 1): no clock, no randomness, no I/O. If a future version
 * needs "today", it becomes a field on `CompensationInput`.
 */
export function calculate(input: CompensationInput): TrueHourlyResult {
  const { hours } = input;

  return {
    hours: {
      hoursPerWeek: hours.hoursPerWeek,
      daysPerWeek: hours.daysPerWeek,
      ptoDays: 0,
      holidayDays: hours.holidayDays,
      unpaidLeaveDays: hours.unpaidLeaveDays,
      hoursWorked: 0,
      daysWorked: 0,
      overridden: hours.hoursWorkedOverride !== null,
    },
    lineItems: [],
    totals: { faceValue: 0, salaryEquivalent: 0 },
    trueHourly: { faceValue: 0, salaryEquivalent: 0 },
    // The one figure the stub computes honestly, because it is the anchor the
    // user arrives with and it depends on nothing else.
    baseHourlyNaive: input.cash.baseSalary / NAIVE_ANNUAL_HOURS,
    warnings: [
      {
        id: 'engine-not-implemented',
        severity: 'caution',
        message: 'The calculation engine is not implemented yet; every total below is zero.',
      },
    ],
  };
}
