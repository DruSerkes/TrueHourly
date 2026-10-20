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

  describe('bonusTreatment changes confidence, never value', () => {
    // The engine does not guess whether a target gets paid — the user says.
    // Same pattern as `stipendTaxTreatment` (DESIGN.md §2.3 note 1).
    const base = { ...defaultCash(), baseSalary: 180_000, bonusTargetPct: 0.1 };

    it('defaults to a target, which is an estimate', () => {
      const item = bonusItem({ ...base, bonusTreatment: 'target' });
      expect(item.confidence).toBe('estimated');
      expect(item.annualValue).toBe(18_000);
    });

    it('is entered when the user says the bonus is earned', () => {
      const item = bonusItem({ ...base, bonusTreatment: 'earned' });
      expect(item.confidence).toBe('entered');
      expect(item.annualValue).toBe(18_000);
    });

    it('values both identically — only the confidence moves', () => {
      expect(bonusItem({ ...base, bonusTreatment: 'target' }).annualValue).toBe(
        bonusItem({ ...base, bonusTreatment: 'earned' }).annualValue
      );
    });

    it('drops "(target)" from the label when it is earned', () => {
      expect(bonusItem({ ...base, bonusTreatment: 'target' }).label).toBe('Annual bonus (target)');
      expect(bonusItem({ ...base, bonusTreatment: 'earned' }).label).toBe('Annual bonus');
    });

    it('says in the note which way it was counted', () => {
      expect(bonusItem({ ...base, bonusTreatment: 'target' }).note).toContain('not guaranteed');
      expect(bonusItem({ ...base, bonusTreatment: 'earned' }).note).toContain('expect to be paid');
    });

    it('stays taxable either way — this is not a bucket question', () => {
      expect(bonusItem({ ...base, bonusTreatment: 'target' }).bucket).toBe('taxable');
      expect(bonusItem({ ...base, bonusTreatment: 'earned' }).bucket).toBe('taxable');
    });
  });

  it('is 0 when there is no bonus', () => {
    expect(bonusItem({ ...defaultCash(), baseSalary: 180_000 }).annualValue).toBe(0);
  });
});

describe('signOnItem confidence', () => {
  // Estimated whenever the figure is a projection, which is what spreading a
  // one-time payment over a predicted tenure makes it. No treatment flag, unlike
  // the bonus: a sign-on has already been paid, so the uncertainty is in the
  // divisor, not in whether the money arrives — and the engine can see the
  // divisor without asking.
  it('is estimated when amortized over more than a year', () => {
    const item = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 4 });
    expect(item.confidence).toBe('estimated');
    expect(item.annualValue).toBe(10_000);
  });

  it('is entered when the whole bonus lands in one year', () => {
    const item = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 1 });
    expect(item.confidence).toBe('entered');
    expect(item.annualValue).toBe(40_000);
  });

  it('is entered at the floor too — a 0-year tenure becomes 1, not a projection', () => {
    const item = signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 0 });
    expect(item.confidence).toBe('entered');
  });

  it('says which way it was counted', () => {
    expect(
      signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 4 }).note
    ).toContain('a prediction');
    expect(
      signOnItem({ ...defaultCash(), signOnBonus: 40_000, expectedTenureYears: 1 }).note
    ).toContain('in full against a single year');
  });

  it('stays taxable either way', () => {
    for (const years of [1, 4]) {
      const item = signOnItem({
        ...defaultCash(),
        signOnBonus: 40_000,
        expectedTenureYears: years,
      });
      expect(item.bucket).toBe('taxable');
    }
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
