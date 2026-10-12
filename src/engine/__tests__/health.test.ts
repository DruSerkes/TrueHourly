/**
 * Health and insurance line items (DESIGN.md §2.3).
 *
 * This is where the gross-up matters most: every item is `tax_free`, so each
 * one contributes MORE to `salaryEquivalent` than to `faceValue`. Both totals
 * are asserted for every item.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import { LIMIT_HEALTH_FSA, LIMIT_HSA_FAMILY, LIMIT_HSA_SELF_ONLY } from '../constants.ts';
import { computeHealthItems, hsaLimitFor } from '../health.ts';
import type { CompensationInput, LineItem, TrueHourlyResult } from '../types.ts';
import { defaultHealth, defaultInput, defaultInsurance, defaultTax } from './_input.ts';

/** A package at t = 0.32, so the gross-up divisor is a clean 0.68. */
function withBenefits(
  health: Partial<CompensationInput['health']> = {},
  insurance: Partial<CompensationInput['insurance']> = {}
): TrueHourlyResult {
  return calculate(
    defaultInput({
      health: { ...defaultHealth(), ...health },
      insurance: { ...defaultInsurance(), ...insurance },
      tax: { ...defaultTax(), combinedMarginalRate: 0.32 },
    })
  );
}

function find(result: TrueHourlyResult, id: string): LineItem | undefined {
  return result.lineItems.find((item) => item.id === id);
}

describe('hsaLimitFor', () => {
  it('picks the limit for the coverage tier', () => {
    expect(hsaLimitFor('self_only')).toBe(LIMIT_HSA_SELF_ONLY);
    expect(hsaLimitFor('family')).toBe(LIMIT_HSA_FAMILY);
  });
});

describe('employer health premium', () => {
  const result = withBenefits({ employerPremiumContribution: 14_000 });

  it('is tax_free', () => {
    expect(find(result, 'employer-health-premium')?.bucket).toBe('tax_free');
    expect(find(result, 'employer-health-premium')?.confidence).toBe('entered');
  });

  it('contributes 14,000 to faceValue', () => {
    expect(result.totals.faceValue).toBe(14_000);
  });

  it('contributes 20,588.24 to salaryEquivalent — 14,000 / 0.68', () => {
    // The single largest correction the app makes. A $14,000 premium is worth
    // more than $14,000 of salary because you never pay tax on it.
    expect(result.totals.salaryEquivalent).toBeCloseTo(20_588.24, 2);
  });

  it('is omitted at $0', () => {
    expect(find(withBenefits(), 'employer-health-premium')).toBeUndefined();
  });
});

describe('employer HSA contribution', () => {
  const result = withBenefits({ employerHsaContribution: 1_000 });

  it('is tax_free and grossed up', () => {
    expect(find(result, 'employer-hsa')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(1_000);
    expect(result.totals.salaryEquivalent).toBeCloseTo(1_000 / 0.68, 2);
  });

  it('clamps to the self-only limit and warns', () => {
    const over = withBenefits({ employerHsaContribution: 9_000, coverageTier: 'self_only' });
    expect(find(over, 'employer-hsa')?.annualValue).toBe(LIMIT_HSA_SELF_ONLY);
    expect(over.warnings.map((w) => w.id)).toContain('hsa-contribution-clamped');
  });

  it('allows the larger family limit on family coverage', () => {
    const family = withBenefits({ employerHsaContribution: 8_000, coverageTier: 'family' });
    expect(find(family, 'employer-hsa')?.annualValue).toBe(8_000);
    expect(family.warnings.map((w) => w.id)).not.toContain('hsa-contribution-clamped');
  });

  it('warns that the limit also covers the employee s own contributions', () => {
    const over = withBenefits({ employerHsaContribution: 9_000, coverageTier: 'family' });
    const warning = over.warnings.find((w) => w.id === 'hsa-contribution-clamped');
    expect(warning?.severity).toBe('caution');
    expect(warning?.message).toContain('family');
  });

  it('does not warn at exactly the limit', () => {
    const atLimit = withBenefits({ employerHsaContribution: LIMIT_HSA_SELF_ONLY });
    expect(atLimit.warnings.map((w) => w.id)).not.toContain('hsa-contribution-clamped');
  });
});

describe('employer FSA seed', () => {
  const result = withBenefits({ employerFsaSeed: 500 });

  it('is tax_free and contributes to both totals', () => {
    expect(find(result, 'employer-fsa-seed')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(500);
    expect(result.totals.salaryEquivalent).toBeCloseTo(500 / 0.68, 2);
  });

  it('is NOT clamped to the employee salary-reduction limit', () => {
    // `LIMIT_HEALTH_FSA` caps what the EMPLOYEE may elect to defer; an employer
    // non-elective seed is not subject to it, and no sourced employer ceiling
    // exists. Clamping here would under-count a real benefit (invariant 5: an
    // unsourced figure is not a constant to apply).
    const large = withBenefits({ employerFsaSeed: 10_000 });
    expect(find(large, 'employer-fsa-seed')?.annualValue).toBe(10_000);
    expect(large.warnings.map((w) => w.id)).not.toContain('fsa-seed-clamped');
    expect(10_000).toBeGreaterThan(LIMIT_HEALTH_FSA);
  });

  it('notes that an FSA is use-it-or-lose-it, unlike an HSA', () => {
    expect(find(result, 'employer-fsa-seed')?.note).toContain('Use-it-or-lose-it');
  });
});

describe('employer-paid life / AD&D premium', () => {
  const result = withBenefits({}, { lifeAndAddPremium: 400, lifeCoverageAmount: 200_000 });
  const life = find(result, 'life-add-premium');

  it('is tax_free, in the insurance category', () => {
    expect(life?.bucket).toBe('tax_free');
    expect(life?.category).toBe('insurance');
  });

  it('contributes to both totals', () => {
    expect(result.totals.faceValue).toBe(400);
    expect(result.totals.salaryEquivalent).toBeCloseTo(400 / 0.68, 2);
  });

  it('carries the $50,000 group term life note (DESIGN.md §2.3 note 2)', () => {
    expect(life?.note).toContain('50,000');
    expect(life?.note).toContain('imputed income');
  });

  it('says the row is generous when coverage exceeds the ceiling', () => {
    // v1 treats the whole premium as tax-free rather than splitting it, so the
    // note has to admit the direction of the error.
    expect(life?.note).toContain('generous');
  });

  it('does not claim to be generous when coverage is under the ceiling', () => {
    const small = withBenefits({}, { lifeAndAddPremium: 200, lifeCoverageAmount: 50_000 });
    expect(find(small, 'life-add-premium')?.note).not.toContain('generous');
  });
});

describe('employer-paid disability premium', () => {
  const result = withBenefits({}, { disabilityPremium: 600 });

  it('is tax_free and contributes to both totals', () => {
    expect(find(result, 'disability-premium')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(600);
    expect(result.totals.salaryEquivalent).toBeCloseTo(600 / 0.68, 2);
  });

  it('notes that an employer-paid premium makes the benefit taxable', () => {
    expect(find(result, 'disability-premium')?.note).toContain('taxable');
  });
});

describe('degenerate input', () => {
  it('emits nothing and warns about nothing when every field is 0', () => {
    const { items, warnings } = computeHealthItems(defaultHealth(), defaultInsurance());
    expect(items).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('treats negative and NaN entries as 0', () => {
    const { items } = computeHealthItems(
      {
        ...defaultHealth(),
        employerPremiumContribution: -5_000,
        employerHsaContribution: NaN,
        employerFsaSeed: -1,
      },
      defaultInsurance()
    );
    expect(items).toEqual([]);
  });
});
