/**
 * The warning set (DESIGN.md §2.5).
 *
 * One test per trigger in §2.5, asserted through `calculate` wherever the
 * trigger is reachable from an input, because that is how the UI will see them.
 * The two exceptions are called out where they appear:
 *
 *   - the 10%-of-total estimated-item rule is unit-tested against
 *     `compositionWarnings` directly, because no engine line item currently
 *     carries `confidence: 'estimated'` (see the block at the bottom), and
 *   - the clamp warnings keep their own tests in `retirement.test.ts`,
 *     `health.test.ts` and `perks.test.ts`, next to the clamps that fire them.
 *
 * Each trigger is tested in BOTH directions. A warning that fires when it
 * should is half the requirement; one that stays quiet when it should is the
 * half that keeps the app from crying wolf, and it is the half a regression
 * actually breaks.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import { WARN_ESTIMATED_SHARE_THRESHOLD } from '../constants.ts';
import { compositionWarnings, taxWarnings } from '../warnings.ts';
import type { CompensationInput, LineItem } from '../types.ts';
import {
  defaultCash,
  defaultHours,
  defaultInput,
  defaultRetirement,
  defaultTax,
} from './_input.ts';

function warningIds(input: CompensationInput): string[] {
  return calculate(input).warnings.map((w) => w.id);
}

function tax(combinedMarginalRate: number, deferredRate = 0): CompensationInput['tax'] {
  return { ...defaultTax(), combinedMarginalRate, deferredRate };
}

describe('hours (DESIGN.md §2.5)', () => {
  it('warns above the 50-hour threshold', () => {
    expect(warningIds(defaultInput({ hours: { ...defaultHours(), hoursPerWeek: 55 } }))).toContain(
      'long-hours'
    );
  });

  it('stays quiet at exactly the threshold', () => {
    expect(
      warningIds(defaultInput({ hours: { ...defaultHours(), hoursPerWeek: 50 } }))
    ).not.toContain('long-hours');
  });

  it('says the headline treats every hour as compensated', () => {
    const warning = calculate(
      defaultInput({ hours: { ...defaultHours(), hoursPerWeek: 60 } })
    ).warnings.find((w) => w.id === 'long-hours');

    expect(warning?.severity).toBe('caution');
    expect(warning?.message).toContain('60 hours a week');
  });

  it('says so when the denominator was overridden, quoting the figure used', () => {
    const warning = calculate(
      defaultInput({ hours: { ...defaultHours(), hoursWorkedOverride: 1_800 } })
    ).warnings.find((w) => w.id === 'hours-overridden');

    expect(warning?.severity).toBe('info');
    expect(warning?.message).toContain('1800');
  });

  it('stays quiet when hours are derived', () => {
    expect(warningIds(defaultInput())).not.toContain('hours-overridden');
  });

  it('explains a zero denominator instead of returning Infinity', () => {
    const input = defaultInput({
      hours: {
        ...defaultHours(),
        ptoPlan: { type: 'accrual', ptoDays: 300, expectedAccruedBalanceDays: 0 },
      },
    });

    expect(warningIds(input)).toContain('no-hours-worked');
    expect(calculate(input).trueHourly.faceValue).toBe(0);
  });
});

describe('unlimited PTO (DESIGN.md §2.1, §2.5)', () => {
  const unlimited = defaultInput({
    hours: { ...defaultHours(), ptoPlan: { type: 'unlimited', expectedDaysTaken: 15 } },
  });

  it('notes the missing separation payout', () => {
    expect(warningIds(unlimited)).toContain('unlimited-pto-no-payout');
  });

  it('is info, not caution — it is a difference, not a risk', () => {
    expect(
      calculate(unlimited).warnings.find((w) => w.id === 'unlimited-pto-no-payout')?.severity
    ).toBe('info');
  });

  it('stays quiet on an accrual plan', () => {
    expect(warningIds(defaultInput())).not.toContain('unlimited-pto-no-payout');
  });

  it('does not assert the folk claim that people take fewer days', () => {
    // DESIGN.md §2.1 is explicit: the evidence does not support it, so the app
    // must not say it. The payout difference is the only claim made.
    const message =
      calculate(unlimited).warnings.find((w) => w.id === 'unlimited-pto-no-payout')?.message ?? '';
    expect(message.toLowerCase()).not.toContain('fewer days');
  });
});

describe('401(k) match with a vesting cliff (DESIGN.md §2.5)', () => {
  function withMatch(annualAmount: number, matchVestingYears: number): CompensationInput {
    return defaultInput({
      cash: { ...defaultCash(), baseSalary: 180_000 },
      retirement: {
        ...defaultRetirement(),
        employerMatch: { type: 'amount', annualAmount },
        matchVestingYears,
      },
    });
  }

  it('warns when both a match and a vesting period are entered', () => {
    expect(warningIds(withMatch(7_200, 3))).toContain('match-vesting-cliff');
  });

  it('quotes the amount at risk and the schedule', () => {
    const warning = calculate(withMatch(7_200, 3)).warnings.find(
      (w) => w.id === 'match-vesting-cliff'
    );

    expect(warning?.severity).toBe('caution');
    expect(warning?.message).toContain('$7,200');
    expect(warning?.message).toContain('3 years');
  });

  it('stays quiet with a match and immediate vesting', () => {
    expect(warningIds(withMatch(7_200, 0))).not.toContain('match-vesting-cliff');
  });

  it('stays quiet with a vesting period but no match', () => {
    // A schedule on $0 is not worth a warning — there is nothing to forfeit.
    expect(warningIds(withMatch(0, 5))).not.toContain('match-vesting-cliff');
  });

  it('says the employee’s own contributions are unaffected', () => {
    expect(
      calculate(withMatch(7_200, 3)).warnings.find((w) => w.id === 'match-vesting-cliff')?.message
    ).toContain('always 100% yours');
  });
});

describe('sign-on clawback (DESIGN.md §2.5)', () => {
  // Fires when the clawback OUTLASTS the expected tenure: that is the case in
  // which the headline counts money the user might have to repay. The reverse
  // is benign and was deliberately flipped in session 2 — see DECISIONS.md.
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

  it('warns when the clawback outlasts the tenure', () => {
    expect(warningIds(withClawback(36, 2))).toContain('sign-on-clawback-outlasts-tenure');
  });

  it('stays quiet when it expires first', () => {
    expect(warningIds(withClawback(12, 4))).not.toContain('sign-on-clawback-outlasts-tenure');
  });

  it('stays quiet when they end together', () => {
    expect(warningIds(withClawback(48, 4))).not.toContain('sign-on-clawback-outlasts-tenure');
  });

  it('stays quiet with no bonus to claw back', () => {
    const noBonus = defaultInput({
      cash: { ...defaultCash(), baseSalary: 180_000, signOnClawbackMonths: 36 },
    });
    expect(warningIds(noBonus)).not.toContain('sign-on-clawback-outlasts-tenure');
  });
});

describe('the tax assumption (DESIGN.md §2.2)', () => {
  it('says nothing at the default rate', () => {
    expect(taxWarnings(defaultTax())).toEqual([]);
  });

  it('warns when a rate was clamped, rather than applying it silently', () => {
    // Invariant 6: the user typed a number and the engine used a different one.
    expect(taxWarnings(tax(1.3)).map((w) => w.id)).toContain('tax-rate-clamped');
  });

  it('quotes the rate it actually applied', () => {
    expect(taxWarnings(tax(1.3)).find((w) => w.id === 'tax-rate-clamped')?.message).toContain(
      '60%'
    );
  });

  it('warns when the deferred rate was clamped', () => {
    expect(taxWarnings(tax(0.32, 5)).map((w) => w.id)).toContain('deferred-rate-clamped');
  });

  it('explains the illiquidity when the deferred rate is raised', () => {
    const warning = taxWarnings(tax(0.32, 0.2)).find((w) => w.id === 'deferred-rate-raised');

    expect(warning?.severity).toBe('info');
    expect(warning?.message).toContain('59.5');
  });

  it('reaches the result through calculate, not just the helper', () => {
    expect(warningIds(defaultInput({ tax: tax(1.3) }))).toContain('tax-rate-clamped');
  });
});

describe('an empty package (DESIGN.md §4, Fixture C)', () => {
  it('says nothing has been entered rather than showing a bare $0', () => {
    expect(warningIds(defaultInput())).toContain('no-compensation-entered');
  });

  it('is not a zero-hours warning — the denominator is fine', () => {
    // 15 PTO + 11 holidays leaves 1,872 hours. It is the numerator that is empty.
    const result = calculate(defaultInput());
    expect(result.hours.hoursWorked).toBeCloseTo(1_872, 2);
    expect(result.warnings.map((w) => w.id)).not.toContain('no-hours-worked');
  });

  it('goes away as soon as there is any compensation', () => {
    expect(warningIds(defaultInput({ cash: { ...defaultCash(), baseSalary: 1 } }))).not.toContain(
      'no-compensation-entered'
    );
  });
});

describe('large estimated line items (DESIGN.md §2.5)', () => {
  // Live as of the bonus-treatment change: a bonus left as a `target` is an
  // `estimated` line item, so this trigger is now reachable from `calculate`.
  // The unit tests below pin the threshold arithmetic; the integration block at
  // the end pins that it actually fires on a real package.
  function item(id: string, annualValue: number, confidence: LineItem['confidence']): LineItem {
    return {
      id,
      label: `Item ${id}`,
      category: 'perks',
      bucket: 'taxable',
      annualValue,
      salaryEquivalent: annualValue,
      confidence,
    };
  }

  const totals = (faceValue: number) => ({ faceValue, salaryEquivalent: faceValue });

  it('warns when one estimate is more than 10% of the package', () => {
    const items = [item('big', 20_000, 'estimated'), item('rest', 80_000, 'entered')];
    const warnings = compositionWarnings(items, totals(100_000));

    expect(warnings.map((w) => w.id)).toEqual(['large-estimated-line-item']);
    expect(warnings[0]?.severity).toBe('caution');
  });

  it('names the item, its value and its share', () => {
    const items = [item('big', 20_000, 'estimated'), item('rest', 80_000, 'entered')];
    const message = compositionWarnings(items, totals(100_000))[0]?.message ?? '';

    expect(message).toContain('Item big');
    expect(message).toContain('$20,000');
    expect(message).toContain('20%');
  });

  it('stays quiet at exactly 10%', () => {
    // Strictly greater than, so the threshold itself is not a warning.
    const items = [item('ten', 10_000, 'estimated'), item('rest', 90_000, 'entered')];
    expect(compositionWarnings(items, totals(100_000))).toEqual([]);
    expect(WARN_ESTIMATED_SHARE_THRESHOLD).toBe(0.1);
  });

  it('ignores a large item the user actually entered', () => {
    const items = [item('big', 90_000, 'entered')];
    expect(compositionWarnings(items, totals(90_000))).toEqual([]);
  });

  it('ignores an unknown item, which is $0 by construction', () => {
    const items = [item('unknown', 0, 'unknown'), item('rest', 100, 'entered')];
    expect(compositionWarnings(items, totals(100))).toEqual([]);
  });

  it('collapses several offenders into one warning with a stable id', () => {
    // Duplicate ids in a list the UI renders by key is a bug waiting to happen.
    const items = [
      item('a', 20_000, 'estimated'),
      item('b', 30_000, 'estimated'),
      item('c', 50_000, 'entered'),
    ];
    const warnings = compositionWarnings(items, totals(100_000));

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain('Item a');
    expect(warnings[0]?.message).toContain('Item b');
  });

  describe('through calculate, on a real package', () => {
    function withBonus(
      bonusTargetPct: number,
      bonusTreatment: CompensationInput['cash']['bonusTreatment']
    ): CompensationInput {
      return defaultInput({
        cash: { ...defaultCash(), baseSalary: 180_000, bonusTargetPct, bonusTreatment },
      });
    }

    it('fires on a 20% bonus target, which is 17% of the package', () => {
      // 36,000 bonus on a 216,000 total. A target that big carries most of the
      // headline's uncertainty and the user should be told.
      expect(warningIds(withBonus(0.2, 'target'))).toContain('large-estimated-line-item');
    });

    it('stays quiet on a 10% bonus target, which is 9% of the package', () => {
      // 18,000 on 198,000. Still an estimate, still rendered as one — just not
      // a large enough share to warrant interrupting the user.
      expect(warningIds(withBonus(0.1, 'target'))).not.toContain('large-estimated-line-item');
    });

    it('stays quiet on any bonus the user marked earned', () => {
      expect(warningIds(withBonus(0.5, 'earned'))).not.toContain('large-estimated-line-item');
    });

    it('fires on a sign-on amortized over a long tenure', () => {
      // $100,000 over 4 years = $25,000/yr against a $205,000 package: 12%.
      // A second route to the same warning, from a different kind of estimate.
      const input = defaultInput({
        cash: {
          ...defaultCash(),
          baseSalary: 180_000,
          signOnBonus: 100_000,
          expectedTenureYears: 4,
          bonusTreatment: 'earned',
        },
      });
      const warning = calculate(input).warnings.find((w) => w.id === 'large-estimated-line-item');
      expect(warning?.message).toContain('Sign-on bonus');
    });

    it('stays quiet on a sign-on counted in a single year', () => {
      // Same $100,000, no projection in it — so nothing to flag as an estimate.
      const input = defaultInput({
        cash: {
          ...defaultCash(),
          baseSalary: 180_000,
          signOnBonus: 100_000,
          expectedTenureYears: 1,
          bonusTreatment: 'earned',
        },
      });
      expect(warningIds(input)).not.toContain('large-estimated-line-item');
    });

    it('names the bonus row in the message', () => {
      const warning = calculate(withBonus(0.2, 'target')).warnings.find(
        (w) => w.id === 'large-estimated-line-item'
      );
      expect(warning?.message).toContain('Annual bonus');
      expect(warning?.message).toContain('$36,000');
    });
  });
});

describe('warning shape (DESIGN.md §2.5: structured data with stable ids)', () => {
  // Everything the engine can say, from one maximal input.
  const result = calculate(
    defaultInput({
      hours: {
        ...defaultHours(),
        hoursPerWeek: 60,
        hoursWorkedOverride: 2_400,
        ptoPlan: { type: 'unlimited', expectedDaysTaken: 15 },
      },
      cash: {
        ...defaultCash(),
        baseSalary: 180_000,
        signOnBonus: 40_000,
        expectedTenureYears: 2,
        signOnClawbackMonths: 36,
      },
      equity: {
        type: 'options',
        grantShares: 4_000,
        strikePrice: 20,
        fairMarketValue: 10,
        vestYears: 4,
        cliffMonths: 12,
        optionClass: 'iso',
      },
      retirement: {
        ...defaultRetirement(),
        employerMatch: { type: 'amount', annualAmount: 7_200 },
        matchVestingYears: 4,
      },
      tax: tax(0.32, 0.2),
    })
  );

  it('emits every id at most once', () => {
    const ids = result.warnings.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every warning an id, a severity and a non-empty message', () => {
    for (const warning of result.warnings) {
      expect(warning.id).toMatch(/^[a-z0-9-]+$/);
      expect(['info', 'caution']).toContain(warning.severity);
      expect(warning.message.length).toBeGreaterThan(20);
    }
  });

  it('reaches the triggers that need cross-cutting information', () => {
    expect(result.warnings.map((w) => w.id)).toEqual(
      expect.arrayContaining([
        'long-hours',
        'hours-overridden',
        'unlimited-pto-no-payout',
        'sign-on-clawback-outlasts-tenure',
        'match-vesting-cliff',
        'options-underwater',
        'options-exercise-cost',
        'iso-amt-exposure',
        'equity-cliff-contingent',
        'deferred-rate-raised',
      ])
    );
  });
});
