/**
 * The orchestrator — the engine's only public export (CLAUDE.md "Layout").
 *
 * Pure by contract (invariant 1): same input, same output, always. No clock, no
 * randomness, no I/O, no side effects. If a future version needs "today", the
 * date becomes a field on `CompensationInput`; it is never read ambiently.
 * `__tests__/purity.test.ts` enforces this — fix the engine, not the test.
 *
 * As of session 4 the engine is feature-complete against DESIGN.md §2: hours,
 * cash, equity in all four modes, retirement, health, insurance, perks, leave,
 * the gross-up, the full warning set, and the off-headline notes. The
 * `engine-partial` warning that stood in for equity is gone — it said something
 * that is no longer true, and leaving it would be the one kind of inaccuracy
 * this file cannot afford.
 *
 * What this function does, in order, and why the order matters:
 *
 *   1. the denominator, because meals and the notes are priced off `daysWorked`
 *   2. each contributor module, each reporting its own clamps as warnings
 *   3. the gross-up, in exactly one place (`tax.ts`)
 *   4. totals, then the cross-cutting warnings that can only be judged once the
 *      totals exist — the 10%-estimated rule is about a proportion, so it
 *      cannot run before there is something to take a proportion of
 */

import { computeCashItems } from './cash.ts';
import { NAIVE_ANNUAL_HOURS } from './constants.ts';
import { computeEquityItems } from './equity.ts';
import { computeHealthItems } from './health.ts';
import { computeHours } from './hours.ts';
import { computeNotes } from './notes.ts';
import { nonNegative } from './numbers.ts';
import { computePerksItems } from './perks.ts';
import { computeRetirementItems } from './retirement.ts';
import { applyGrossUp } from './tax.ts';
import { compositionWarnings, inputWarnings } from './warnings.ts';
import type { CompensationInput, LineItem, TrueHourlyResult } from './types.ts';

export function calculate(input: CompensationInput): TrueHourlyResult {
  const hours = computeHours(input.hours);

  // Each contributor module computes its own face values and reports any
  // statutory clamp or structural risk it is the only one positioned to see.
  const equity = computeEquityItems(input.equity);
  const retirement = computeRetirementItems(input.retirement, input.cash.baseSalary);
  const health = computeHealthItems(input.health, input.insurance);
  const perks = computePerksItems({ perks: input.perks, leave: input.leave, hours });

  const drafts = [
    ...computeCashItems(input.cash),
    ...equity.items,
    ...retirement.items,
    ...health.items,
    ...perks.items,
  ];

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
  // Infinity — `no-hours-worked` explains why (Fixture C).
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
    // Private equity only. Absent for every other mode, so the UI can key the
    // scenario panel off its presence (DESIGN.md §3).
    ...(equity.scenarios === undefined ? {} : { equityScenarios: equity.scenarios }),
    warnings: [
      ...inputWarnings(input, hours),
      ...equity.warnings,
      ...retirement.warnings,
      ...health.warnings,
      ...perks.warnings,
      ...compositionWarnings(lineItems, totals),
    ],
    // Off-headline (DESIGN.md §2.6). Deliberately computed AFTER the totals and
    // never folded into them: a note is a card, not a line item.
    notes: computeNotes(input, hours),
  };
}
