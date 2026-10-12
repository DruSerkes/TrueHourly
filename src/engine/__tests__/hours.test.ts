/**
 * The denominator (DESIGN.md §2.1, CLAUDE.md invariant 2).
 *
 * The cases that matter here are the degenerate ones. A wrong hourly rate from
 * a plausible input is a bug someone notices; an `Infinity` from an empty form
 * is a bug every first-time visitor sees.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import { computeHours, ptoDaysOf } from '../hours.ts';
import { defaultCash, defaultHours, defaultInput } from './_input.ts';

describe('computeHours', () => {
  it('derives the DESIGN.md §2.1 example', () => {
    const hours = computeHours({
      ...defaultHours(),
      hoursPerWeek: 45,
      daysPerWeek: 5,
      ptoPlan: { type: 'accrual', ptoDays: 20, expectedAccruedBalanceDays: 0 },
      holidayDays: 11,
    });

    expect(hours.hoursWorked).toBeCloseTo(2_061, 2);
    expect(hours.daysWorked).toBeCloseTo(229, 2);
  });

  it('counts unpaid leave as time off', () => {
    const hours = computeHours({
      ...defaultHours(),
      hoursPerWeek: 40,
      daysPerWeek: 5,
      ptoPlan: { type: 'accrual', ptoDays: 0, expectedAccruedBalanceDays: 0 },
      holidayDays: 0,
      unpaidLeaveDays: 10,
    });

    // 10 days = 2 weeks off; 40 x 50 = 2,000
    expect(hours.hoursWorked).toBeCloseTo(2_000, 2);
  });

  it('treats unlimited PTO identically in the denominator', () => {
    const accrual = computeHours({
      ...defaultHours(),
      ptoPlan: { type: 'accrual', ptoDays: 15, expectedAccruedBalanceDays: 0 },
    });
    const unlimited = computeHours({
      ...defaultHours(),
      ptoPlan: { type: 'unlimited', expectedDaysTaken: 15 },
    });

    // DESIGN.md §2.1: the plan type changes the separation payout, not the math.
    // The app must not assert that unlimited-PTO employees take fewer days.
    expect(unlimited.hoursWorked).toBe(accrual.hoursWorked);
    expect(unlimited.ptoDays).toBe(15);
  });

  describe('zero hours', () => {
    it('returns 0, not a negative number, when PTO exceeds the year', () => {
      const hours = computeHours({
        ...defaultHours(),
        daysPerWeek: 5,
        // 300 days off against a 260-day work year
        ptoPlan: { type: 'accrual', ptoDays: 300, expectedAccruedBalanceDays: 0 },
        holidayDays: 0,
      });

      expect(hours.hoursWorked).toBe(0);
      expect(hours.daysWorked).toBe(0);
      // Still reports what the user entered, so the breakdown is auditable.
      expect(hours.ptoDays).toBe(300);
    });

    it('returns 0 when hoursPerWeek is 0', () => {
      expect(computeHours({ ...defaultHours(), hoursPerWeek: 0 }).hoursWorked).toBe(0);
    });

    it('lands exactly on 0 at precisely 52 weeks off', () => {
      const hours = computeHours({
        ...defaultHours(),
        daysPerWeek: 5,
        ptoPlan: { type: 'accrual', ptoDays: 260, expectedAccruedBalanceDays: 0 },
        holidayDays: 0,
      });

      expect(hours.hoursWorked).toBe(0);
    });
  });

  describe('guards against impossible input', () => {
    it('never divides by a daysPerWeek of 0', () => {
      const hours = computeHours({ ...defaultHours(), daysPerWeek: 0 });

      expect(Number.isFinite(hours.hoursWorked)).toBe(true);
      expect(hours.daysPerWeek).toBe(1);
    });

    it('clamps a daysPerWeek above 7', () => {
      expect(computeHours({ ...defaultHours(), daysPerWeek: 9 }).daysPerWeek).toBe(7);
    });

    it('treats negative time off as zero', () => {
      const hours = computeHours({
        ...defaultHours(),
        hoursPerWeek: 40,
        daysPerWeek: 5,
        ptoPlan: { type: 'accrual', ptoDays: -20, expectedAccruedBalanceDays: 0 },
        holidayDays: 0,
      });

      // Negative PTO must not manufacture hours above 52 full weeks.
      expect(hours.hoursWorked).toBeCloseTo(2_080, 2);
      expect(hours.ptoDays).toBe(0);
    });

    it('survives NaN from a corrupt restored save', () => {
      const hours = computeHours({ ...defaultHours(), hoursPerWeek: Number.NaN });

      expect(hours.hoursWorked).toBe(0);
      expect(Number.isFinite(hours.daysWorked)).toBe(true);
    });
  });

  describe('override', () => {
    it('uses the override and flags it', () => {
      const hours = computeHours({ ...defaultHours(), hoursWorkedOverride: 1_500 });

      expect(hours.hoursWorked).toBe(1_500);
      expect(hours.overridden).toBe(true);
    });

    it('keeps daysWorked derived from time off, not from the override', () => {
      const hours = computeHours({ ...defaultHours(), hoursWorkedOverride: 1_500 });

      // The override is a statement about hours; free meals are priced per day,
      // and there is no defensible way to infer a day count from an hours slider.
      expect(hours.daysWorked).toBeCloseTo(234, 2);
    });

    it('clamps a negative override to 0 and still flags it', () => {
      const hours = computeHours({ ...defaultHours(), hoursWorkedOverride: -40 });

      expect(hours.hoursWorked).toBe(0);
      expect(hours.overridden).toBe(true);
    });

    it('treats an override of 0 as an override, not as absent', () => {
      // `null` means derive; 0 is a deliberate statement. Conflating them would
      // make the UI say "derived" while showing the user's own number.
      expect(computeHours({ ...defaultHours(), hoursWorkedOverride: 0 }).overridden).toBe(true);
    });
  });
});

describe('ptoDaysOf', () => {
  it('reads days granted under an accrual plan', () => {
    expect(ptoDaysOf({ type: 'accrual', ptoDays: 20, expectedAccruedBalanceDays: 5 })).toBe(20);
  });

  it('reads days expected to be taken under an unlimited plan', () => {
    expect(ptoDaysOf({ type: 'unlimited', expectedDaysTaken: 12 })).toBe(12);
  });
});

describe('sabbatical (DESIGN.md §2.1)', () => {
  // A paid sabbatical is full salary for weeks not worked, so its value is a
  // smaller denominator — exactly like PTO (invariant 2). It has no line item;
  // `perks.test.ts` asserts that it never acquires one.

  it('amortizes weeks over the cycle and takes them out of hours worked', () => {
    // Default: 15 PTO + 11 holidays = 5.2 weeks off, 46.8 worked, 1,872 hours.
    // 6 weeks every 5 years adds 1.2 weeks off → 45.6 worked → 1,824 hours.
    const hours = computeHours({
      ...defaultHours(),
      sabbaticalWeeks: 6,
      sabbaticalCycleYears: 5,
    });
    expect(hours.sabbaticalWeeksPerYear).toBeCloseTo(1.2, 10);
    expect(hours.hoursWorked).toBeCloseTo(1_824, 10);
    expect(hours.daysWorked).toBeCloseTo(228, 10);
  });

  it('raises the true hourly rate, because the salary is unchanged', () => {
    // The whole reason it belongs in the denominator: same money, fewer hours.
    const base = { ...defaultCash(), baseSalary: 180_000 };
    const without = calculate(defaultInput({ cash: base }));
    const with_ = calculate(
      defaultInput({
        cash: base,
        hours: { ...defaultHours(), sabbaticalWeeks: 6, sabbaticalCycleYears: 5 },
      })
    );
    expect(with_.trueHourly.faceValue).toBeGreaterThan(without.trueHourly.faceValue);
    expect(with_.totals.faceValue).toBe(without.totals.faceValue);
  });

  it('is inert when the cycle is 0, rather than dividing by zero', () => {
    const hours = computeHours({
      ...defaultHours(),
      sabbaticalWeeks: 6,
      sabbaticalCycleYears: 0,
    });
    expect(hours.sabbaticalWeeksPerYear).toBe(0);
    expect(hours.hoursWorked).toBeCloseTo(1_872, 10);
  });

  it('is inert at 0 weeks, whatever the cycle', () => {
    const hours = computeHours({
      ...defaultHours(),
      sabbaticalWeeks: 0,
      sabbaticalCycleYears: 5,
    });
    expect(hours.sabbaticalWeeksPerYear).toBe(0);
    expect(hours.hoursWorked).toBeCloseTo(1_872, 10);
  });

  it('launders negative and NaN inputs to 0', () => {
    expect(
      computeHours({ ...defaultHours(), sabbaticalWeeks: -6, sabbaticalCycleYears: 5 })
        .sabbaticalWeeksPerYear
    ).toBe(0);
    expect(
      computeHours({ ...defaultHours(), sabbaticalWeeks: NaN, sabbaticalCycleYears: NaN })
        .sabbaticalWeeksPerYear
    ).toBe(0);
  });

  it('cannot drive hours worked below 0 on its own', () => {
    // A 520-week sabbatical every year is nonsense; it must floor at 0, not go
    // negative and produce a negative hourly rate.
    const hours = computeHours({
      ...defaultHours(),
      sabbaticalWeeks: 520,
      sabbaticalCycleYears: 1,
    });
    expect(hours.hoursWorked).toBe(0);
    expect(hours.daysWorked).toBe(0);
  });
});
