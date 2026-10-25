/**
 * Equity in all four modes (DESIGN.md §2.4).
 *
 * The assertions that matter most here are not the arithmetic ones. They are:
 *
 *   - a private grant contributes **$0** to both totals no matter how large the
 *     scenario range beside it (invariant 6), and
 *   - an underwater option contributes **$0**, never a negative.
 *
 * Both are places where a plausible-looking implementation would produce a
 * number the app has no business asserting.
 *
 * Every mode also gets the contribution-to-both-totals assertion CLAUDE.md
 * requires of a new line item. Equity is `taxable` in every mode, so the two
 * totals must be EQUAL even at t = 0.32 — if a future change grossed equity up,
 * these are the tests that would catch it.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import {
  computeEquityItems,
  optionsIntrinsicPerYear,
  privateEquityScenarios,
  publicEquityPerYear,
} from '../equity.ts';
import type {
  EquityInput,
  LineItem,
  OptionsEquity,
  PrivateEquity,
  TrueHourlyResult,
} from '../types.ts';
import { PRIVATE_EQUITY_DEFAULTS, defaultInput, defaultTax } from './_input.ts';

/** A package whose only compensation is equity, at t = 0.32. */
function withEquity(equity: EquityInput): TrueHourlyResult {
  return calculate(defaultInput({ equity, tax: { ...defaultTax(), combinedMarginalRate: 0.32 } }));
}

function find(result: TrueHourlyResult, id: string): LineItem | undefined {
  return result.lineItems.find((item) => item.id === id);
}

function warningIds(equity: EquityInput): string[] {
  return computeEquityItems(equity).warnings.map((w) => w.id);
}

/** 10,000 shares at $10 of last-round price, vesting over 4 years. */
function privateGrant(overrides: Partial<PrivateEquity> = {}): PrivateEquity {
  return {
    type: 'private',
    grantShares: 10_000,
    lastPreferredPricePerShare: 10,
    vestYears: 4,
    cliffMonths: 12,
    ...PRIVATE_EQUITY_DEFAULTS,
    ...overrides,
  };
}

/** 4,000 options at a $2 strike against a $10 FMV, vesting over 4 years. */
function optionGrant(overrides: Partial<OptionsEquity> = {}): OptionsEquity {
  return {
    type: 'options',
    grantShares: 4_000,
    strikePrice: 2,
    fairMarketValue: 10,
    vestYears: 4,
    cliffMonths: 0,
    optionClass: 'nso',
    ...overrides,
  };
}

describe("equity.type === 'none'", () => {
  const result = withEquity({ type: 'none' });

  it('contributes no line item at all', () => {
    expect(result.lineItems.filter((item) => item.category === 'equity')).toEqual([]);
  });

  it('emits no equity warning and no scenarios', () => {
    expect(computeEquityItems({ type: 'none' })).toEqual({ items: [], warnings: [] });
    expect(result.equityScenarios).toBeUndefined();
  });
});

describe("equity.type === 'unknown'", () => {
  const result = withEquity({ type: 'unknown' });

  it('contributes $0 to both totals', () => {
    expect(find(result, 'equity-unknown')?.annualValue).toBe(0);
    expect(result.totals.faceValue).toBe(0);
    expect(result.totals.salaryEquivalent).toBe(0);
  });

  it('shows the row rather than omitting it, flagged unknown', () => {
    // Omitting it would look as though the user forgot to enter equity. The row
    // says the app knows there is equity and is counting it at zero.
    expect(find(result, 'equity-unknown')?.confidence).toBe('unknown');
  });

  it('warns and points at the private estimator', () => {
    const warning = result.warnings.find((w) => w.id === 'equity-unknown');
    expect(warning?.severity).toBe('caution');
    expect(warning?.message).toContain('private estimator');
  });

  it('calls the headline a floor, not an estimate', () => {
    expect(result.warnings.find((w) => w.id === 'equity-unknown')?.message).toContain('floor');
  });

  it('runs no scenario — there are no shares to run one on', () => {
    expect(result.equityScenarios).toBeUndefined();
  });
});

describe("equity.type === 'public' (DESIGN.md §2.4)", () => {
  const grant = {
    type: 'public' as const,
    grantShares: 1_000,
    pricePerShare: 100,
    vestYears: 4,
    cliffMonths: 0,
  };
  const result = withEquity(grant);

  it('is shares x price / vestYears', () => {
    // 1,000 x 100 / 4 = 25,000
    expect(publicEquityPerYear(grant)).toBe(25_000);
    expect(find(result, 'rsu-vesting')?.annualValue).toBe(25_000);
  });

  it('is taxable, so it contributes the same amount to both totals', () => {
    expect(find(result, 'rsu-vesting')?.bucket).toBe('taxable');
    expect(result.totals.faceValue).toBe(25_000);
    expect(result.totals.salaryEquivalent).toBe(25_000);
  });

  it('warns that one grant is not a steady annual rate', () => {
    const warning = result.warnings.find((w) => w.id === 'equity-initial-grant-not-steady-state');
    expect(warning?.message).toContain('refresher');
  });

  it('warns about a cliff when there is one', () => {
    expect(warningIds({ ...grant, cliffMonths: 12 })).toContain('equity-cliff-contingent');
  });

  it('stays quiet about a cliff when there is none', () => {
    expect(warningIds(grant)).not.toContain('equity-cliff-contingent');
  });

  it('floors vestYears at 1 rather than dividing by zero', () => {
    // A grant that vests immediately is worth all of it in year one.
    expect(publicEquityPerYear({ ...grant, vestYears: 0 })).toBe(100_000);
  });

  it('launders a NaN price into $0 rather than propagating it', () => {
    expect(publicEquityPerYear({ ...grant, pricePerShare: Number.NaN })).toBe(0);
  });

  it('emits no row and no warnings for an empty grant', () => {
    expect(computeEquityItems({ ...grant, grantShares: 0 })).toEqual({ items: [], warnings: [] });
  });

  it('carries no scenarios — the price is observable', () => {
    expect(result.equityScenarios).toBeUndefined();
  });
});

describe("equity.type === 'private' — the scenario model (DESIGN.md §2.4)", () => {
  const grant = privateGrant();
  const result = withEquity(grant);
  const scenarios = privateEquityScenarios(grant);

  it('discounts common, then dilutes, then annualizes', () => {
    // 10,000 x $10 = 100,000 preferred
    //   x (1 - 0.30) common discount = 70,000
    //   x (1 - 0.25) dilution        = 52,500
    //   / 4 years                    = 13,125
    expect(scenarios.modest).toBeCloseTo(13_125, 2);
  });

  it('orders the scenarios zero < modest < strong', () => {
    expect(scenarios.zero).toBe(0);
    expect(scenarios.zero).toBeLessThan(scenarios.modest);
    expect(scenarios.modest).toBeLessThan(scenarios.strong);
  });

  it('multiplies modest by strongMultiple for the strong case', () => {
    expect(scenarios.strong).toBeCloseTo(13_125 * 3, 2);
  });

  it('echoes every assumption back so the UI can show its work', () => {
    expect(scenarios.assumptions).toEqual({
      commonDiscount: 0.3,
      expectedDilution: 0.25,
      strongMultiple: 3,
      vestYears: 4,
    });
  });

  describe('the headline uses zero (invariant 6)', () => {
    it('contributes $0 to both totals however large the range is', () => {
      expect(find(result, 'private-equity')?.annualValue).toBe(0);
      expect(result.totals.faceValue).toBe(0);
      expect(result.totals.salaryEquivalent).toBe(0);
      // ...while the scenario beside it says $13,125/yr. Both are true, and
      // only one of them belongs in a headline.
      expect(result.equityScenarios?.modest).toBeCloseTo(13_125, 2);
    });

    it('flags the row as unknown, not entered', () => {
      expect(find(result, 'private-equity')?.confidence).toBe('unknown');
    });

    it('explains in the note why the row is $0', () => {
      expect(find(result, 'private-equity')?.note).toContain('worth nothing');
    });

    it('says the same thing in a warning, with the modest figure', () => {
      const warning = result.warnings.find((w) => w.id === 'private-equity-headline-zero');
      expect(warning?.severity).toBe('info');
      expect(warning?.message).toContain('$13,125');
    });

    it('attaches the scenarios to the result only for private equity', () => {
      expect(result.equityScenarios).toBeDefined();
      expect(withEquity({ type: 'none' }).equityScenarios).toBeUndefined();
    });
  });

  describe('each assumption moves the output in the expected direction', () => {
    const modestWith = (overrides: Partial<PrivateEquity>): number =>
      privateEquityScenarios(privateGrant(overrides)).modest;

    it('a bigger common discount lowers the value', () => {
      expect(modestWith({ commonDiscount: 0.5 })).toBeLessThan(scenarios.modest);
    });

    it('less common discount raises it', () => {
      expect(modestWith({ commonDiscount: 0 })).toBeGreaterThan(scenarios.modest);
    });

    it('more expected dilution lowers it', () => {
      expect(modestWith({ expectedDilution: 0.5 })).toBeLessThan(scenarios.modest);
    });

    it('a longer vesting period lowers the per-year figure', () => {
      expect(modestWith({ vestYears: 8 })).toBeCloseTo(scenarios.modest / 2, 2);
    });

    it('a bigger strong multiple raises only the strong case', () => {
      const bigger = privateEquityScenarios(privateGrant({ strongMultiple: 10 }));
      expect(bigger.strong).toBeGreaterThan(scenarios.strong);
      expect(bigger.modest).toBeCloseTo(scenarios.modest, 2);
    });

    it('a 100% discount leaves nothing, and does not go negative past it', () => {
      // Clamped at 1: a discount of 1.5 would otherwise flip the sign and turn
      // a worthless grant into a positive number.
      expect(modestWith({ commonDiscount: 1 })).toBe(0);
      expect(modestWith({ commonDiscount: 1.5 })).toBe(0);
    });
  });

  it('still emits the row, and no headline warning, for an empty grant', () => {
    const empty = computeEquityItems(privateGrant({ grantShares: 0 }));
    expect(empty.items).toHaveLength(1);
    expect(empty.warnings.map((w) => w.id)).not.toContain('private-equity-headline-zero');
  });
});

describe("equity.type === 'options' (DESIGN.md §2.4)", () => {
  const grant = optionGrant();
  const result = withEquity(grant);

  it('is intrinsic value only: (fmv - strike) x sharesPerYear', () => {
    // (10 - 2) x (4,000 / 4) = 8,000
    expect(optionsIntrinsicPerYear(grant)).toBe(8_000);
    expect(find(result, 'options-intrinsic')?.annualValue).toBe(8_000);
  });

  it('is taxable and contributes the same amount to both totals', () => {
    expect(find(result, 'options-intrinsic')?.bucket).toBe('taxable');
    expect(result.totals.faceValue).toBe(8_000);
    expect(result.totals.salaryEquivalent).toBe(8_000);
  });

  it('always warns about the exercise cost, with the real figure', () => {
    // 4,000 x $2 = $8,000 of the user's own money, which the line item ignores.
    const warning = result.warnings.find((w) => w.id === 'options-exercise-cost');
    expect(warning?.severity).toBe('caution');
    expect(warning?.message).toContain('$8,000');
  });

  describe('underwater', () => {
    const underwater = optionGrant({ strikePrice: 15 });
    const result = withEquity(underwater);

    it('contributes $0, never a negative', () => {
      expect(optionsIntrinsicPerYear(underwater)).toBe(0);
      expect(find(result, 'options-intrinsic')?.annualValue).toBe(0);
      expect(result.totals.faceValue).toBe(0);
      expect(result.totals.salaryEquivalent).toBe(0);
    });

    it('emits a caution saying so', () => {
      const warning = result.warnings.find((w) => w.id === 'options-underwater');
      expect(warning?.severity).toBe('caution');
      expect(warning?.message).toContain('underwater');
    });

    it('says the options are not worthless, only underwater today', () => {
      expect(result.warnings.find((w) => w.id === 'options-underwater')?.message).toContain(
        'not worthless'
      );
    });

    it('still shows the row, with the reason in the note', () => {
      expect(find(result, 'options-intrinsic')?.note).toContain('underwater');
    });

    it('stays quiet about being underwater at exactly the strike', () => {
      expect(warningIds(optionGrant({ strikePrice: 10 }))).not.toContain('options-underwater');
    });
  });

  describe('ISO vs NSO', () => {
    it('warns about AMT for ISOs', () => {
      const warning = withEquity(optionGrant({ optionClass: 'iso' })).warnings.find(
        (w) => w.id === 'iso-amt-exposure'
      );
      expect(warning?.message).toContain('alternative minimum tax');
    });

    it('stays quiet about AMT for NSOs', () => {
      expect(warningIds(optionGrant({ optionClass: 'nso' }))).not.toContain('iso-amt-exposure');
    });

    it('labels the row with the class the user chose', () => {
      expect(
        find(withEquity(optionGrant({ optionClass: 'iso' })), 'options-intrinsic')?.label
      ).toContain('ISO');
      expect(find(result, 'options-intrinsic')?.label).toContain('NSO');
    });
  });

  it('emits nothing for an empty grant', () => {
    expect(computeEquityItems(optionGrant({ grantShares: 0 }))).toEqual({
      items: [],
      warnings: [],
    });
  });

  it('floors vestYears at 1 rather than dividing by zero', () => {
    expect(optionsIntrinsicPerYear(optionGrant({ vestYears: 0 }))).toBe(32_000);
  });

  it('carries no scenarios', () => {
    expect(result.equityScenarios).toBeUndefined();
  });
});

describe('no mode produces a non-finite number (Fixture C discipline)', () => {
  const absurd: EquityInput[] = [
    { type: 'none' },
    { type: 'unknown' },
    {
      type: 'public',
      grantShares: Number.NaN,
      pricePerShare: Number.POSITIVE_INFINITY,
      vestYears: 0,
      cliffMonths: -5,
    },
    privateGrant({
      grantShares: Number.POSITIVE_INFINITY,
      lastPreferredPricePerShare: Number.NaN,
      vestYears: -1,
      commonDiscount: Number.NaN,
      expectedDilution: 2,
      strongMultiple: Number.NaN,
    }),
    optionGrant({
      grantShares: Number.NaN,
      strikePrice: Number.POSITIVE_INFINITY,
      fairMarketValue: Number.NaN,
      vestYears: 0,
    }),
  ];

  it.each(absurd.map((equity) => [equity.type, equity] as const))(
    '%s survives absurd input',
    (_label, equity) => {
      const contribution = computeEquityItems(equity);
      for (const item of contribution.items) {
        expect(Number.isFinite(item.annualValue)).toBe(true);
      }
      if (contribution.scenarios !== undefined) {
        const { zero, modest, strong } = contribution.scenarios;
        for (const value of [zero, modest, strong]) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  );
});
