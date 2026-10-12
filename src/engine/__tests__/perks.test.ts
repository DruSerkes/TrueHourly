/**
 * Perks, stipends, and paid leave (DESIGN.md §2.3).
 *
 * The load-bearing test in this file is the first one: meals must be priced at
 * days ACTUALLY WORKED. A flat 250 days would reintroduce the double-count
 * invariant 2 exists to prevent — the denominator and this numerator have to
 * move together.
 *
 * Sabbatical is NOT tested here: it is a denominator input, so its tests live in
 * `hours.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import { LIMIT_COMMUTER_MONTHLY, LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE } from '../constants.ts';
import type { CompensationInput, LineItem, TrueHourlyResult } from '../types.ts';
import { defaultHours, defaultInput, defaultLeave, defaultPerks, defaultTax } from './_input.ts';

/** A package at t = 0.32 with only perk and leave fields set. */
function withPerks(
  perks: Partial<CompensationInput['perks']> = {},
  leave: Partial<CompensationInput['leave']> = {}
): TrueHourlyResult {
  return calculate(
    defaultInput({
      perks: { ...defaultPerks(), ...perks },
      leave: { ...defaultLeave(), ...leave },
      tax: { ...defaultTax(), combinedMarginalRate: 0.32 },
    })
  );
}

function find(result: TrueHourlyResult, id: string): LineItem | undefined {
  return result.lineItems.find((item) => item.id === id);
}

describe('free meals', () => {
  // Default hours: 15 PTO + 11 holidays over a 5-day week = 5.2 weeks off,
  // so 46.8 weeks x 5 = 234 days worked.
  const result = withPerks({ meals: { enabled: true, valuePerDay: 15 } });

  it('prices at days actually worked, not a flat 250', () => {
    // 234 x 15 = 3,510. A flat 250 would say 3,750 and would be counting days
    // the user is on holiday.
    expect(result.hours.daysWorked).toBeCloseTo(234, 2);
    expect(find(result, 'meals')?.annualValue).toBe(3_510);
  });

  it('is tax_free, so it contributes more to salaryEquivalent than to faceValue', () => {
    expect(find(result, 'meals')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(3_510);
    expect(result.totals.salaryEquivalent).toBeCloseTo(3_510 / 0.68, 2);
  });

  it('shrinks when the user takes more time off', () => {
    // 40 PTO + 11 holidays = 51 days / 5 = 10.2 weeks off, so 41.8 x 5 = 209
    // days worked and 209 x 15 = 3,135 of meals. The same perk is worth less to
    // someone who is in the office less.
    const moreTimeOff = calculate(
      defaultInput({
        hours: {
          ...defaultHours(),
          ptoPlan: { type: 'accrual', ptoDays: 40, expectedAccruedBalanceDays: 0 },
        },
        perks: { ...defaultPerks(), meals: { enabled: true, valuePerDay: 15 } },
      })
    );
    expect(moreTimeOff.hours.daysWorked).toBeCloseTo(209, 2);
    expect(find(moreTimeOff, 'meals')?.annualValue).toBe(3_135);
  });

  it('is absent when meals are not enabled', () => {
    expect(
      find(withPerks({ meals: { enabled: false, valuePerDay: 15 } }), 'meals')
    ).toBeUndefined();
  });

  it('is absent when enabled at $0 a day', () => {
    expect(find(withPerks({ meals: { enabled: true, valuePerDay: 0 } }), 'meals')).toBeUndefined();
  });

  it('says in the note that it used real days worked', () => {
    expect(find(result, 'meals')?.note).toContain('234 days actually worked');
  });
});

describe('commuter benefit', () => {
  const result = withPerks({ commuterBenefitMonthly: 200 });

  it('annualizes the monthly figure', () => {
    expect(find(result, 'commuter-benefit')?.annualValue).toBe(2_400);
  });

  it('is tax_free and contributes to both totals', () => {
    expect(find(result, 'commuter-benefit')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(2_400);
    expect(result.totals.salaryEquivalent).toBeCloseTo(2_400 / 0.68, 2);
  });

  it('clamps to the monthly exclusion and warns', () => {
    const over = withPerks({ commuterBenefitMonthly: 500 });
    expect(find(over, 'commuter-benefit')?.annualValue).toBe(LIMIT_COMMUTER_MONTHLY * 12);
    expect(over.warnings.map((w) => w.id)).toContain('commuter-benefit-clamped');
  });

  it('does not warn at exactly the limit', () => {
    const atLimit = withPerks({ commuterBenefitMonthly: LIMIT_COMMUTER_MONTHLY });
    expect(atLimit.warnings.map((w) => w.id)).not.toContain('commuter-benefit-clamped');
  });
});

describe('tuition reimbursement', () => {
  const result = withPerks({ tuitionReimbursement: 3_000 });

  it('is tax_free and contributes to both totals', () => {
    expect(find(result, 'tuition-reimbursement')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(3_000);
    expect(result.totals.salaryEquivalent).toBeCloseTo(3_000 / 0.68, 2);
  });

  it('clamps to the §127 limit and warns', () => {
    const over = withPerks({ tuitionReimbursement: 12_000 });
    expect(find(over, 'tuition-reimbursement')?.annualValue).toBe(
      LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE
    );
    expect(over.warnings.map((w) => w.id)).toContain('tuition-reimbursement-clamped');
  });

  it('says the excess is still real money, just taxable', () => {
    const over = withPerks({ tuitionReimbursement: 12_000 });
    expect(over.warnings.find((w) => w.id === 'tuition-reimbursement-clamped')?.message).toContain(
      'taxable wages'
    );
  });
});

describe('stipends', () => {
  it('default to taxable, so they are not grossed up (DESIGN.md §2.3 note 1)', () => {
    const result = withPerks({ homeOfficeStipend: 1_200, wellnessStipend: 600 });
    expect(find(result, 'home-office-stipend')?.bucket).toBe('taxable');
    expect(find(result, 'wellness-stipend')?.bucket).toBe('taxable');
    expect(result.totals.faceValue).toBe(1_800);
    expect(result.totals.salaryEquivalent).toBe(1_800);
  });

  it('become tax_free when marked as an accountable-plan reimbursement', () => {
    const result = withPerks({
      homeOfficeStipend: 1_200,
      wellnessStipend: 600,
      stipendTaxTreatment: 'tax_free',
    });
    expect(find(result, 'home-office-stipend')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(1_800);
    expect(result.totals.salaryEquivalent).toBeCloseTo(1_800 / 0.68, 2);
  });

  it('explain the flip in the note either way', () => {
    expect(find(withPerks({ wellnessStipend: 600 }), 'wellness-stipend')?.note).toContain(
      'accountable plan'
    );
    expect(
      find(withPerks({ wellnessStipend: 600, stipendTaxTreatment: 'tax_free' }), 'wellness-stipend')
        ?.note
    ).toContain('excluded from income');
  });
});

describe('professional development budget', () => {
  const result = withPerks({ professionalDevelopment: 2_000 });

  it('is tax_free and contributes to both totals', () => {
    expect(find(result, 'professional-development')?.bucket).toBe('tax_free');
    expect(result.totals.faceValue).toBe(2_000);
    expect(result.totals.salaryEquivalent).toBeCloseTo(2_000 / 0.68, 2);
  });
});

describe('paid parental leave', () => {
  it('is off the headline by default', () => {
    const result = withPerks({}, { parentalLeaveWeeks: 12, parentalLeaveWeeklyRate: 2_000 });
    expect(find(result, 'parental-leave')).toBeUndefined();
    expect(result.totals.faceValue).toBe(0);
  });

  it('is weeks x weekly rate, taxable, when the user opts in', () => {
    const result = withPerks(
      {},
      {
        parentalLeaveWeeks: 12,
        parentalLeaveWeeklyRate: 2_000,
        includeParentalLeaveInHeadline: true,
      }
    );
    expect(find(result, 'parental-leave')?.bucket).toBe('taxable');
    expect(find(result, 'parental-leave')?.category).toBe('leave');
    expect(result.totals.faceValue).toBe(24_000);
    expect(result.totals.salaryEquivalent).toBe(24_000);
  });
});

describe('no PTO or sabbatical line item ever (invariant 2)', () => {
  it('emits nothing resembling time off even with every perk and leave field set', () => {
    const result = withPerks(
      {
        meals: { enabled: true, valuePerDay: 15 },
        commuterBenefitMonthly: 200,
        tuitionReimbursement: 3_000,
        homeOfficeStipend: 1_200,
        wellnessStipend: 600,
        professionalDevelopment: 2_000,
      },
      {
        parentalLeaveWeeks: 12,
        parentalLeaveWeeklyRate: 2_000,
        includeParentalLeaveInHeadline: true,
      }
    );
    const labels = result.lineItems.map((item) => item.label.toLowerCase());
    expect(
      labels.some((l) => l.includes('pto') || l.includes('time off') || l.includes('holiday'))
    ).toBe(false);
  });
});
