/**
 * Retirement line items (DESIGN.md §2.3, category `retirement`).
 *
 * Every line item here is asserted against BOTH totals through `calculate`, not
 * just against its own draft: a tax_deferred dollar that gets grossed up like a
 * tax_free one is exactly the error invariant 3 exists to prevent, and a draft
 * on its own cannot catch it.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import { LIMIT_DEFINED_CONTRIBUTION_TOTAL } from '../constants.ts';
import { computeRetirementItems, employerMatchAmount, esppDiscountValue } from '../retirement.ts';
import type { CompensationInput, LineItem, TrueHourlyResult } from '../types.ts';
import { defaultCash, defaultInput, defaultRetirement, defaultTax } from './_input.ts';

/** A package with a 30% tax rate and only the retirement fields set. */
function withRetirement(
  retirement: Partial<CompensationInput['retirement']>,
  baseSalary = 0
): TrueHourlyResult {
  return calculate(
    defaultInput({
      cash: { ...defaultCash(), baseSalary },
      retirement: { ...defaultRetirement(), ...retirement },
      tax: { ...defaultTax(), combinedMarginalRate: 0.3 },
    })
  );
}

function find(result: TrueHourlyResult, id: string): LineItem | undefined {
  return result.lineItems.find((item) => item.id === id);
}

describe('employerMatchAmount', () => {
  it('passes a flat amount through', () => {
    expect(employerMatchAmount({ type: 'amount', annualAmount: 7_200 }, 180_000)).toBe(7_200);
  });

  it('takes a percent of base', () => {
    expect(
      employerMatchAmount(
        { type: 'percent_of_base', percentOfBase: 0.04, capDollars: null },
        180_000
      )
    ).toBe(7_200);
  });

  it('applies a dollar cap to a percent match', () => {
    expect(
      employerMatchAmount(
        { type: 'percent_of_base', percentOfBase: 0.06, capDollars: 5_000 },
        180_000
      )
    ).toBe(5_000);
  });

  it('treats a null cap as uncapped, not as zero', () => {
    // The distinction that matters: reading a missing cap as 0 would silently
    // delete a real match.
    const uncapped = employerMatchAmount(
      { type: 'percent_of_base', percentOfBase: 0.06, capDollars: null },
      180_000
    );
    const zeroCapped = employerMatchAmount(
      { type: 'percent_of_base', percentOfBase: 0.06, capDollars: 0 },
      180_000
    );
    expect(uncapped).toBe(10_800);
    expect(zeroCapped).toBe(0);
  });

  it('is 0 when the user has no salary to take a percentage of', () => {
    expect(
      employerMatchAmount({ type: 'percent_of_base', percentOfBase: 0.04, capDollars: null }, 0)
    ).toBe(0);
  });

  it('launders a NaN percentage to 0 rather than propagating it', () => {
    expect(
      employerMatchAmount(
        { type: 'percent_of_base', percentOfBase: NaN, capDollars: null },
        180_000
      )
    ).toBe(0);
  });
});

describe('401(k) employer match', () => {
  const result = withRetirement({ employerMatch: { type: 'amount', annualAmount: 7_200 } });
  const match = find(result, 'employer-401k-match');

  it('is tax_deferred at face value', () => {
    expect(match?.bucket).toBe('tax_deferred');
    expect(match?.annualValue).toBe(7_200);
    expect(match?.confidence).toBe('entered');
  });

  it('contributes 7,200 to faceValue', () => {
    expect(result.totals.faceValue).toBe(7_200);
  });

  it('contributes 7,200 to salaryEquivalent — NOT grossed up (invariant 3)', () => {
    // 7,200 / (1 - 0.30) would be 10,286. A 401(k) match is taxed as ordinary
    // income on withdrawal and is illiquid until 59.5; treating it as tax-free
    // is the error CLAUDE.md says discredits the whole tool.
    expect(result.totals.salaryEquivalent).toBe(7_200);
  });

  it('notes the percentage and cap when the match is stated that way', () => {
    const pct = withRetirement(
      { employerMatch: { type: 'percent_of_base', percentOfBase: 0.04, capDollars: 5_000 } },
      180_000
    );
    expect(find(pct, 'employer-401k-match')?.note).toContain('4%');
    expect(find(pct, 'employer-401k-match')?.note).toContain('5000');
  });

  it('omits the row entirely at $0', () => {
    expect(find(withRetirement({}), 'employer-401k-match')).toBeUndefined();
  });
});

describe('profit sharing and student loan match', () => {
  const result = withRetirement({ profitSharing: 4_000, studentLoanMatch: 2_500 });

  it('are both tax_deferred at face value', () => {
    for (const id of ['profit-sharing', 'student-loan-match']) {
      expect(find(result, id)?.bucket).toBe('tax_deferred');
    }
    expect(find(result, 'profit-sharing')?.annualValue).toBe(4_000);
    expect(find(result, 'student-loan-match')?.annualValue).toBe(2_500);
  });

  it('contribute 6,500 to both totals', () => {
    expect(result.totals.faceValue).toBe(6_500);
    expect(result.totals.salaryEquivalent).toBe(6_500);
  });

  it('explains that a student loan match lands in the 401(k), not the bank', () => {
    expect(find(result, 'student-loan-match')?.note).toContain('401(k)');
  });
});

describe('§415(c) annual additions limit', () => {
  it('leaves contributions inside the limit untouched', () => {
    const result = withRetirement({
      employerMatch: { type: 'amount', annualAmount: 20_000 },
      profitSharing: 20_000,
    });
    expect(result.totals.faceValue).toBe(40_000);
    expect(result.warnings.map((w) => w.id)).not.toContain('annual-additions-limit-clamped');
  });

  it('scales an over-limit package down to the limit and warns', () => {
    const result = withRetirement({
      employerMatch: { type: 'amount', annualAmount: 60_000 },
      profitSharing: 60_000,
    });

    expect(result.totals.faceValue).toBeCloseTo(LIMIT_DEFINED_CONTRIBUTION_TOTAL, 0);
    expect(result.warnings.map((w) => w.id)).toContain('annual-additions-limit-clamped');
  });

  it('scales proportionally rather than draining one contribution first', () => {
    // 60,000 + 30,000 = 90,000 against a 72,000 limit → factor 0.8.
    // A priority order would leave the match at 60,000 and cut profit sharing to
    // 12,000, which is an invented plan rule.
    const { items } = computeRetirementItems(
      {
        ...defaultRetirement(),
        employerMatch: { type: 'amount', annualAmount: 60_000 },
        profitSharing: 30_000,
      },
      0
    );
    const value = (id: string) => items.find((i) => i.id === id)?.annualValue;
    expect(value('employer-401k-match')).toBe(48_000);
    expect(value('profit-sharing')).toBe(24_000);
  });

  it('says in the warning that employee deferrals are not counted', () => {
    const result = withRetirement({ profitSharing: 100_000 });
    const warning = result.warnings.find((w) => w.id === 'annual-additions-limit-clamped');
    expect(warning?.severity).toBe('caution');
    expect(warning?.message).toContain('your own 401(k) contributions');
  });
});

describe('esppDiscountValue', () => {
  it('values the gain on money contributed, not the discount off the price', () => {
    // $10,000 of payroll buys $11,765 of stock at a 15% discount → $1,765 gain.
    // `contribution × rate` would say $1,500, which understates it.
    expect(
      esppDiscountValue({ annualContribution: 10_000, discountRate: 0.15, hasLookback: false })
    ).toBeCloseTo(1_764.71, 2);
  });

  it('is 0 at a 0% discount', () => {
    expect(
      esppDiscountValue({ annualContribution: 10_000, discountRate: 0, hasLookback: false })
    ).toBe(0);
  });

  it('clamps an impossible discount instead of dividing by zero', () => {
    // A 100% discount would make `1 - d` zero; above 100% it goes negative and
    // a benefit becomes a liability. Both are reachable from a restored save.
    const atOne = esppDiscountValue({
      annualContribution: 10_000,
      discountRate: 1,
      hasLookback: false,
    });
    const aboveOne = esppDiscountValue({
      annualContribution: 10_000,
      discountRate: 1.5,
      hasLookback: false,
    });
    expect(Number.isFinite(atOne)).toBe(true);
    expect(atOne).toBeGreaterThan(0);
    expect(aboveOne).toBe(atOne);
  });
});

describe('ESPP line item', () => {
  const result = withRetirement({
    espp: { annualContribution: 10_000, discountRate: 0.15, hasLookback: true },
  });
  const espp = find(result, 'espp-discount');

  it('is taxable, so it is not grossed up', () => {
    expect(espp?.bucket).toBe('taxable');
    expect(espp?.annualValue).toBe(1_765);
  });

  it('contributes 1,765 to both totals', () => {
    expect(result.totals.faceValue).toBe(1_765);
    expect(result.totals.salaryEquivalent).toBe(1_765);
  });

  it('says it ignores the lookback and holding-period treatment', () => {
    expect(espp?.note).toContain('lookback');
    expect(espp?.note).toContain('holding-period');
  });

  it('is absent when the user has no ESPP', () => {
    expect(find(withRetirement({ espp: null }), 'espp-discount')).toBeUndefined();
  });
});
