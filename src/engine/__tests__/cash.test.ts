/**
 * Cash line items (DESIGN.md §2.3, category `cash`).
 */

import { describe, expect, it } from 'vitest';
import { baseSalaryItem, bonusItem, computeCashItems, signOnItem } from '../cash.ts';
import { defaultCash } from './_input.ts';

describe('baseSalaryItem', () => {
  it('is taxable at face value', () => {
    const item = baseSalaryItem({ ...defaultCash(), baseSalary: 180_000 });

    expect(item.bucket).toBe('taxable');
    expect(item.annualValue).toBe(180_000);
    expect(item.confidence).toBe('entered');
  });

  describe('zero salary', () => {
    it('is a $0 row, not an absent one', () => {
      // The anchor row stays in the breakdown so the list doesn't reshuffle as
      // the user types.
      expect(baseSalaryItem(defaultCash()).annualValue).toBe(0);
    });
  });

  it('treats a negative salary as 0', () => {
    expect(baseSalaryItem({ ...defaultCash(), baseSalary: -5_000 }).annualValue).toBe(0);
  });
});

describe('bonusItem', () => {
  it('takes the target percentage of base', () => {
    const item = bonusItem({ ...defaultCash(), baseSalary: 180_000, bonusTargetPct: 0.1 });

    expect(item.annualValue).toBe(18_000);
    expect(item.bucket).toBe('taxable');
  });

  it('notes that a target is not a guarantee', () => {
    const item = bonusItem({ ...defaultCash(), baseSalary: 180_000, bonusTargetPct: 0.15 });

    expect(item.note).toBeDefined();
  });

  it('rounds to whole dollars', () => {
    // Money is stored as whole dollars per year throughout the engine.
    const item = bonusItem({ ...defaultCash(), baseSalary: 133_333, bonusTargetPct: 0.075 });

    expect(item.annualValue).toBe(10_000);
  });

  it('is 0 when there is no bonus', () => {
    expect(bonusItem({ ...defaultCash(), baseSalary: 180_000 }).annualValue).toBe(0);
  });
});

describe('signOnItem', () => {
  it('amortizes over expected tenure', () => {
    const item = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 4 });

    expect(item.annualValue).toBe(10_000);
    expect(item.bucket).toBe('taxable');
  });

  it('is worth more per year to someone who plans to leave sooner', () => {
    const staying = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 4 });
    const leaving = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 2 });

    expect(leaving.annualValue).toBe(staying.annualValue * 2);
  });

  it('never divides by a tenure of 0', () => {
    const item = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 0 });

    // Floors at one year, which attributes the whole bonus to year one — what
    // actually happened — instead of producing Infinity.
    expect(item.annualValue).toBe(40_000);
  });

  it('states the amortization window in its note', () => {
    const item = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 4 });

    expect(item.note).toContain('4 year');
  });
});

describe('computeCashItems', () => {
  it('includes only rows that contribute', () => {
    const items = computeCashItems({ ...defaultCash(), baseSalary: 180_000 });

    expect(items.map((item) => item.id)).toEqual(['base-salary']);
  });

  it('includes bonus and sign-on when they are non-zero', () => {
    const items = computeCashItems({
      ...defaultCash(),
      baseSalary: 180_000,
      bonusTargetPct: 0.1,
      signOnBonus: 40_000,
      expectedTenureYears: 4,
    });

    expect(items.map((item) => item.id)).toEqual(['base-salary', 'annual-bonus', 'sign-on-bonus']);
  });

  it('puts every cash dollar in exactly one bucket: taxable (invariant 3)', () => {
    const items = computeCashItems({
      ...defaultCash(),
      baseSalary: 180_000,
      bonusTargetPct: 0.1,
      signOnBonus: 40_000,
    });

    expect(items.every((item) => item.bucket === 'taxable')).toBe(true);
  });

  it('gives every item a unique id', () => {
    const items = computeCashItems({
      ...defaultCash(),
      baseSalary: 180_000,
      bonusTargetPct: 0.1,
      signOnBonus: 40_000,
    });
    const ids = items.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
