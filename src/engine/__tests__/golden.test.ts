/**
 * GOLDEN FIXTURES — DESIGN.md §4.
 *
 * The expected values in this file are HAND-COMPUTED and AUTHORITATIVE.
 *
 *   Do not change an expected value to make a test pass.
 *
 * If the engine disagrees with a fixture, one of the two is wrong and it needs a
 * human decision logged in `docs/DECISIONS.md`. Editing the fixture is how a
 * tool like this silently becomes wrong: the number in DESIGN.md was derived
 * independently of the code, which is the only reason it can falsify the code.
 *
 * ── Why parts of this file are skipped ──────────────────────────────────
 *
 * Fixtures A and B are whole-package figures: they include a 401(k) match,
 * employer health premium, HSA contribution, free meals, and public RSUs, none
 * of which the engine computes yet (session 2 covers hours + cash + tax). Those
 * assertions sit in `describe.skip` blocks and are enabled as the sessions that
 * implement them land:
 *
 *   - session 3 (retirement, health, perks) → the `tax_free` / `tax_deferred` totals
 *   - session 4 (equity)                    → the RSU contribution, then the headline totals
 *
 * The inputs below are already complete, so enabling a block is deleting
 * `.skip` and nothing else. Everything that depends only on hours and cash runs
 * today — that is the part of the fixture session 2 can actually falsify.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import type { CompensationInput, TrueHourlyResult } from '../types.ts';
import {
  defaultCash,
  defaultHealth,
  defaultHours,
  defaultInput,
  defaultPerks,
  defaultRetirement,
  defaultTax,
} from './_input.ts';

/** Dollar-per-hour figures must match to the cent (DESIGN.md §4). */
const CENTS = 2;

/**
 * Fixture A — "NYC mid-level, public company, 45h weeks".
 * Fixture B is the same package with `hoursPerWeek: 60`, so both are built from
 * this one function; if they drifted apart the comparison B is making would be
 * meaningless.
 */
function fixtureAInput(hoursPerWeek: number): CompensationInput {
  return defaultInput({
    hours: {
      ...defaultHours(),
      hoursPerWeek,
      daysPerWeek: 5,
      ptoPlan: { type: 'accrual', ptoDays: 20, expectedAccruedBalanceDays: 0 },
      holidayDays: 11,
    },
    cash: { ...defaultCash(), baseSalary: 180_000, bonusTargetPct: 0.1 },
    // 1,000 shares at $100 over 4 years = $25,000/yr, per DESIGN.md §4's
    // "100,000 grant / 4 years". Session 4 consumes this.
    equity: {
      type: 'public',
      grantShares: 1_000,
      pricePerShare: 100,
      vestYears: 4,
      cliffMonths: 0,
    },
    retirement: { ...defaultRetirement(), employerMatch: 7_200 },
    health: {
      ...defaultHealth(),
      employerPremiumContribution: 14_000,
      employerHsaContribution: 1_000,
    },
    perks: { ...defaultPerks(), meals: { enabled: true, valuePerDay: 15 } },
    tax: { ...defaultTax(), combinedMarginalRate: 0.32 },
  });
}

/** Sum of the `cash` category only — the part session 2 is responsible for. */
function cashFaceValue(result: TrueHourlyResult): number {
  return result.lineItems
    .filter((item) => item.category === 'cash')
    .reduce((sum, item) => sum + item.annualValue, 0);
}

describe('Fixture A — NYC mid-level, public company, 45h weeks (DESIGN.md §4)', () => {
  const result = calculate(fixtureAInput(45));

  describe('hours (enabled: session 2)', () => {
    it('works 2,061 hours a year', () => {
      // weeksOff = (20 + 11) / 5 = 6.2 ; weeksWorked = 45.8 ; 45 x 45.8 = 2,061
      expect(result.hours.hoursWorked).toBeCloseTo(2_061, CENTS);
    });

    it('works 229 days a year', () => {
      // 45.8 x 5 = 229 — drives the $15/day meals line in session 3
      expect(result.hours.daysWorked).toBeCloseTo(229, CENTS);
    });

    it('reports the denominator it used, unrounded and not overridden', () => {
      expect(result.hours.ptoDays).toBe(20);
      expect(result.hours.holidayDays).toBe(11);
      expect(result.hours.overridden).toBe(false);
    });
  });

  describe('cash and the naive anchor (enabled: session 2)', () => {
    it('anchors at $86.54/hr — the number the user arrived believing', () => {
      // 180,000 / 2,080. The whole product is the delta from this figure.
      expect(result.baseHourlyNaive).toBeCloseTo(86.54, CENTS);
    });

    it('contributes $198,000 of cash: $180,000 base + $18,000 bonus', () => {
      // The 223,000 `taxable` total in DESIGN.md §4 is this plus 25,000 of RSUs,
      // which session 4 adds.
      expect(cashFaceValue(result)).toBe(198_000);
    });

    it('values the target bonus at 10% of base', () => {
      const bonus = result.lineItems.find((item) => item.id === 'annual-bonus');
      expect(bonus?.annualValue).toBe(18_000);
    });

    it('puts every cash dollar in the taxable bucket at face value', () => {
      // Invariant 3: no gross-up on taxable money, so salaryEquivalent === annualValue
      // even at t = 0.32.
      for (const item of result.lineItems.filter((i) => i.category === 'cash')) {
        expect(item.bucket).toBe('taxable');
        expect(item.salaryEquivalent).toBe(item.annualValue);
      }
    });

    it('never emits a PTO line item (invariant 2)', () => {
      // PTO's value is the smaller denominator above. A line item here would be
      // double-counting, which DESIGN.md §2.1 calls the most common error in
      // this category of tool.
      const labels = result.lineItems.map((item) => item.label.toLowerCase());
      expect(labels.some((label) => label.includes('pto') || label.includes('time off'))).toBe(
        false
      );
    });
  });

  describe.skip('whole package (enable in session 4, once equity lands)', () => {
    it('totals $248,635 at face value', () => {
      // 223,000 taxable + 18,435 tax_free + 7,200 tax_deferred
      expect(result.totals.faceValue).toBeCloseTo(248_635, CENTS);
    });

    it('totals $257,310.29 in salary-equivalent dollars', () => {
      // 223,000 + (18,435 / 0.68) + 7,200 — tax_deferred is NOT grossed up
      expect(result.totals.salaryEquivalent).toBeCloseTo(257_310.29, CENTS);
    });

    it('reaches $120.64/hr at face value', () => {
      expect(result.trueHourly.faceValue).toBeCloseTo(120.64, CENTS);
    });

    it('reaches $124.85/hr in salary-equivalent terms', () => {
      // The story: the user believed $86.54. Benefits and RSUs are worth more
      // than the extra 5 hours a week cost.
      expect(result.trueHourly.salaryEquivalent).toBeCloseTo(124.85, CENTS);
    });
  });

  describe.skip('bucket composition (enable in session 3, once benefits land)', () => {
    const sumBucket = (bucket: string): number =>
      result.lineItems
        .filter((item) => item.bucket === bucket)
        .reduce((sum, item) => sum + item.annualValue, 0);

    it('puts $18,435 in tax_free: 14,000 premium + 1,000 HSA + 3,435 meals', () => {
      expect(sumBucket('tax_free')).toBeCloseTo(18_435, CENTS);
    });

    it('puts $7,200 in tax_deferred: the 401(k) match', () => {
      expect(sumBucket('tax_deferred')).toBeCloseTo(7_200, CENTS);
    });

    it('values meals at $3,435 — 229 days x $15', () => {
      const meals = result.lineItems.find((item) => item.id === 'meals');
      expect(meals?.annualValue).toBeCloseTo(3_435, CENTS);
    });
  });
});

describe('Fixture B — same package, 60-hour weeks (DESIGN.md §4)', () => {
  const result = calculate(fixtureAInput(60));

  describe('hours (enabled: session 2)', () => {
    it('works 2,748 hours a year', () => {
      // 60 x 45.8. Same time off, same money, 687 more hours.
      expect(result.hours.hoursWorked).toBeCloseTo(2_748, CENTS);
    });

    it('leaves the naive anchor unchanged at $86.54/hr', () => {
      // baseHourlyNaive is always salary / 2,080 — it never knows about real
      // hours. That is precisely what makes it the wrong number.
      expect(result.baseHourlyNaive).toBeCloseTo(86.54, CENTS);
    });

    it('warns that the headline treats all 60 hours as compensated', () => {
      expect(result.warnings.map((w) => w.id)).toContain('long-hours');
    });

    it('changes nothing about the numerator', () => {
      expect(cashFaceValue(result)).toBe(198_000);
    });
  });

  describe.skip('whole package (enable in session 4, once equity lands)', () => {
    it('falls to $90.48/hr at face value', () => {
      expect(result.trueHourly.faceValue).toBeCloseTo(90.48, CENTS);
    });

    it('falls to $93.64/hr in salary-equivalent terms', () => {
      // The story: grinding 60 hours erases nearly the entire benefits
      // advantage — ~$125/hr becomes ~$94/hr on an identical offer.
      expect(result.trueHourly.salaryEquivalent).toBeCloseTo(93.64, CENTS);
    });
  });
});

/**
 * Every number anywhere in a result, found structurally rather than by naming
 * fields, so a field added in a later session is covered without anyone
 * remembering to update this.
 */
function allNumbers(value: unknown, path = '$'): Array<[string, number]> {
  if (typeof value === 'number') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => allNumbers(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => allNumbers(v, `${path}.${k}`));
  }
  return [];
}

describe('Fixture C — degenerate input (DESIGN.md §4)', () => {
  // baseSalary = 0, everything else default. Fully satisfiable in session 2 and
  // enabled now on purpose: it constrains the implementation instead of
  // ratifying it.
  const result = calculate(defaultInput());

  it('produces no NaN and no Infinity anywhere in the result', () => {
    const bad = allNumbers(result).filter(([, n]) => !Number.isFinite(n));
    expect(bad).toEqual([]);
  });

  it('returns a trueHourly of 0 rather than 0/0', () => {
    expect(result.trueHourly.faceValue).toBe(0);
    expect(result.trueHourly.salaryEquivalent).toBe(0);
  });

  it('returns a baseHourlyNaive of 0', () => {
    expect(result.baseHourlyNaive).toBe(0);
  });

  it('returns a warning', () => {
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('still computes a real denominator', () => {
    // 15 PTO + 11 holidays = 5.2 weeks off; 40 x 46.8 = 1,872 hours. A zero
    // salary is not a zero year.
    expect(result.hours.hoursWorked).toBeCloseTo(1_872, CENTS);
  });

  it('shows base salary as a $0 row rather than omitting it', () => {
    const base = result.lineItems.find((item) => item.id === 'base-salary');
    expect(base?.annualValue).toBe(0);
  });

  it('omits bonus and sign-on rows that would be $0', () => {
    const ids = result.lineItems.map((item) => item.id);
    expect(ids).not.toContain('annual-bonus');
    expect(ids).not.toContain('sign-on-bonus');
  });
});
