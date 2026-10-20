/**
 * The bucket gross-up (DESIGN.md §2.2, CLAUDE.md invariant 3).
 *
 * The asymmetry between `tax_free` and `tax_deferred` is the single most
 * important assertion in this file. Grossing up a 401(k) match like a health
 * premium overstates it, and is the kind of error that discredits the tool.
 */

import { describe, expect, it } from 'vitest';
import { MAX_TAX_RATE } from '../constants.ts';
import { applyGrossUp, clampRate, grossUp } from '../tax.ts';
import type { LineItemDraft, TaxBucket, TaxInput } from '../types.ts';

function item(bucket: TaxBucket, annualValue: number): LineItemDraft {
  return { id: 'x', label: 'x', category: 'health', bucket, annualValue, confidence: 'entered' };
}

function tax(combinedMarginalRate: number, deferredRate = 0): TaxInput {
  return { combinedMarginalRate, deferredRate };
}

describe('grossUp', () => {
  it('leaves taxable money at face value', () => {
    expect(grossUp(item('taxable', 180_000), tax(0.32))).toBe(180_000);
  });

  it('grosses up tax_free money by 1 / (1 - t)', () => {
    // DESIGN.md §4 Fixture A: 18,435 / 0.68
    expect(grossUp(item('tax_free', 18_435), tax(0.32))).toBeCloseTo(27_110.29, 2);
  });

  it('leaves tax_deferred money at face value by default (invariant 3)', () => {
    // A 401(k) match is taxed as ordinary income on withdrawal and is illiquid
    // until 59.5. It must NOT be grossed up like a tax-free benefit.
    expect(grossUp(item('tax_deferred', 7_200), tax(0.32))).toBe(7_200);
  });

  it('values a tax_free dollar above a taxable one', () => {
    const free = grossUp(item('tax_free', 1_000), tax(0.32));
    const taxed = grossUp(item('taxable', 1_000), tax(0.32));

    expect(free).toBeGreaterThan(taxed);
  });

  it('grosses up tax_deferred only when the user raises the deferred rate', () => {
    expect(grossUp(item('tax_deferred', 7_200), tax(0.32, 0.2))).toBeCloseTo(9_000, 2);
  });

  describe('tax rate of 0', () => {
    it('makes every bucket face value', () => {
      // At t = 0 the gross-up is the identity — there is no unit mismatch to fix.
      expect(grossUp(item('tax_free', 14_000), tax(0))).toBe(14_000);
      expect(grossUp(item('tax_deferred', 7_200), tax(0))).toBe(7_200);
      expect(grossUp(item('taxable', 180_000), tax(0))).toBe(180_000);
    });
  });

  describe('tax rate at the clamp ceiling', () => {
    it(`treats a rate above ${MAX_TAX_RATE} as ${MAX_TAX_RATE}`, () => {
      const atCeiling = grossUp(item('tax_free', 10_000), tax(MAX_TAX_RATE));
      const absurd = grossUp(item('tax_free', 10_000), tax(0.95));

      expect(atCeiling).toBeCloseTo(25_000, 2);
      expect(absurd).toBe(atCeiling);
    });

    it('never returns a negative value for a rate above 1', () => {
      // Unclamped, `10,000 / (1 - 1.3)` is -33,333: a benefit rendered as a
      // liability. Reachable from a corrupt localStorage restore.
      expect(grossUp(item('tax_free', 10_000), tax(1.3))).toBeGreaterThan(0);
    });

    it('never divides by zero at a rate of exactly 1', () => {
      expect(Number.isFinite(grossUp(item('tax_free', 10_000), tax(1)))).toBe(true);
    });

    it('treats a negative rate as 0', () => {
      expect(grossUp(item('tax_free', 10_000), tax(-0.2))).toBe(10_000);
    });

    it('survives NaN', () => {
      expect(Number.isFinite(grossUp(item('tax_free', 10_000), tax(Number.NaN)))).toBe(true);
    });
  });
});

describe('clampRate', () => {
  it('passes a plausible rate through untouched', () => {
    expect(clampRate(0.32)).toBe(0.32);
    expect(clampRate(0)).toBe(0);
    expect(clampRate(MAX_TAX_RATE)).toBe(MAX_TAX_RATE);
  });

  it('clamps both ends', () => {
    expect(clampRate(-1)).toBe(0);
    expect(clampRate(2)).toBe(MAX_TAX_RATE);
  });
});

describe('applyGrossUp', () => {
  it('is the only way a salaryEquivalent is written', () => {
    const finished = applyGrossUp(item('tax_free', 14_000), tax(0.3));

    expect(finished.salaryEquivalent).toBeCloseTo(20_000, 2);
    expect(finished.annualValue).toBe(14_000);
  });
});

// `taxWarnings` moved to `warnings.ts` in session 4 and is tested in
// `warnings.test.ts`. This file keeps the arithmetic; that one keeps the prose.
