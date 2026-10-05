/**
 * The orchestrator: assembly and the warnings it emits (DESIGN.md §2.5).
 *
 * The line-item math is tested in `hours.test.ts`, `cash.test.ts` and
 * `tax.test.ts`; the headline figures in `golden.test.ts`. What is left for
 * here is whether `calculate` puts those pieces together correctly and says the
 * right things about the result.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import type { CompensationInput } from '../types.ts';
import { defaultCash, defaultHours, defaultInput, defaultTax } from './_input.ts';

function warningIds(input: CompensationInput): string[] {
  return calculate(input).warnings.map((w) => w.id);
}

describe('totals', () => {
  const result = calculate(
    defaultInput({
      cash: {
        ...defaultCash(),
        baseSalary: 180_000,
        bonusTargetPct: 0.1,
        signOnBonus: 40_000,
        expectedTenureYears: 4,
      },
      tax: { ...defaultTax(), combinedMarginalRate: 0.32 },
    })
  );

  it('sums the line items', () => {
    // 180,000 + 18,000 + 10,000
    expect(result.totals.faceValue).toBe(208_000);
  });

  it('leaves the salary-equivalent total equal to face value when all cash is taxable', () => {
    // Invariant 3: no gross-up on taxable money. The two totals only diverge
    // once tax_free benefits land in session 3.
    expect(result.totals.salaryEquivalent).toBe(result.totals.faceValue);
  });

  it('divides by hours worked, not by 2,080', () => {
    // 15 PTO + 11 holidays = 5.2 weeks off; 40 x 46.8 = 1,872 hours
    expect(result.trueHourly.faceValue).toBeCloseTo(208_000 / 1_872, 2);
    expect(result.baseHourlyNaive).toBeCloseTo(180_000 / 2_080, 2);
  });
});

describe('sign-on clawback warning (DESIGN.md §2.5)', () => {
  function withClawback(clawbackMonths: number, tenureYears: number): CompensationInput {
    return defaultInput({
      cash: {
        ...defaultCash(),
        baseSalary: 180_000,
        signOnBonus: 40_000,
        expectedTenureYears: tenureYears,
        signOnClawbackMonths: clawbackMonths,
      },
    });
  }

  it('warns when the clawback outlasts the expected tenure', () => {
    // 36 months of clawback against a 2-year plan: leaving as expected means
    // repaying money the headline already counted.
    expect(warningIds(withClawback(36, 2))).toContain('sign-on-clawback-outlasts-tenure');
  });

  it('is a caution, not a note', () => {
    const warning = calculate(withClawback(36, 2)).warnings.find(
      (w) => w.id === 'sign-on-clawback-outlasts-tenure'
    );

    expect(warning?.severity).toBe('caution');
    expect(warning?.message).toContain('36 months');
  });

  it('stays quiet when the clawback expires before the tenure is up', () => {
    // The benign case: after 12 months the money is unconditional, and the only
    // consequence is that the amortized figure is conservative.
    expect(warningIds(withClawback(12, 4))).not.toContain('sign-on-clawback-outlasts-tenure');
  });

  it('stays quiet when the clawback ends exactly at the expected tenure', () => {
    expect(warningIds(withClawback(48, 4))).not.toContain('sign-on-clawback-outlasts-tenure');
  });

  it('stays quiet when there is no clawback', () => {
    expect(warningIds(withClawback(0, 4))).not.toContain('sign-on-clawback-outlasts-tenure');
  });

  it('stays quiet when there is no sign-on bonus to claw back', () => {
    const input = defaultInput({
      cash: { ...defaultCash(), baseSalary: 180_000, signOnClawbackMonths: 36 },
    });

    expect(warningIds(input)).not.toContain('sign-on-clawback-outlasts-tenure');
  });
});

describe('other warnings', () => {
  it('warns about long hours above the threshold', () => {
    expect(warningIds(defaultInput({ hours: { ...defaultHours(), hoursPerWeek: 60 } }))).toContain(
      'long-hours'
    );
  });

  it('stays quiet about hours at 40 a week', () => {
    expect(warningIds(defaultInput())).not.toContain('long-hours');
  });

  it('notes the missing separation payout under unlimited PTO', () => {
    const input = defaultInput({
      hours: { ...defaultHours(), ptoPlan: { type: 'unlimited', expectedDaysTaken: 15 } },
    });

    expect(warningIds(input)).toContain('unlimited-pto-no-payout');
  });

  it('says so when the denominator was overridden', () => {
    const input = defaultInput({ hours: { ...defaultHours(), hoursWorkedOverride: 1_800 } });

    expect(warningIds(input)).toContain('hours-overridden');
  });

  it('explains a zero denominator instead of returning Infinity', () => {
    const input = defaultInput({
      hours: {
        ...defaultHours(),
        ptoPlan: { type: 'accrual', ptoDays: 300, expectedAccruedBalanceDays: 0 },
      },
      cash: { ...defaultCash(), baseSalary: 180_000 },
    });
    const result = calculate(input);

    expect(result.warnings.map((w) => w.id)).toContain('no-hours-worked');
    expect(result.trueHourly.faceValue).toBe(0);
  });

  it('admits the engine is still partial', () => {
    expect(warningIds(defaultInput())).toContain('engine-partial');
  });
});
