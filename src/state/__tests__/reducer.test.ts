/**
 * What this file actually protects.
 *
 * The reducer is three lines per branch, so it is not the arithmetic that is at
 * risk — it is the two properties the rest of the design leans on:
 *
 *   1. **State stays plain and JSON-serializable.** Session 6's autosave, v2's
 *      shareable link, and v2's compare mode all assume `JSON.parse(
 *      JSON.stringify(state))` is the same value. A `Date`, a class instance or
 *      an `undefined` slipped into the defaults breaks all three at once, and
 *      it breaks them in session 6, far from the change that caused it.
 *   2. **Nothing is mutated.** React 19 Strict Mode double-invokes reducers in
 *      development; a branch that mutated would produce two different answers
 *      for one dispatch, and `calculate` would be handed a value that had
 *      already moved on.
 */

import { describe, expect, it } from 'vitest';
import { defaultCompensationInput } from '../defaults.ts';
import {
  asAmountMatch,
  asPercentMatch,
  inputReducer,
  matchAmountOf,
  ptoDaysOf,
  withPtoDays,
} from '../reducer.ts';
import type { InputAction } from '../reducer.ts';
import {
  DEFAULT_HOURS_PER_WEEK,
  DEFAULT_PTO_DAYS,
  DEFAULT_TAX_RATE,
} from '../../engine/constants.ts';

describe('the default input', () => {
  it('mirrors constants.ts rather than hardcoding its own figures', () => {
    const input = defaultCompensationInput();
    expect(input.hours.hoursPerWeek).toBe(DEFAULT_HOURS_PER_WEEK);
    expect(ptoDaysOf(input.hours.ptoPlan)).toBe(DEFAULT_PTO_DAYS);
    expect(input.tax.combinedMarginalRate).toBe(DEFAULT_TAX_RATE);
  });

  it('invents no compensation figure', () => {
    // Invariant 6, applied to a first load: the app must not open with a
    // plausible salary it made up.
    const input = defaultCompensationInput();
    expect(input.cash.baseSalary).toBe(0);
    expect(input.health.employerPremiumContribution).toBe(0);
    expect(matchAmountOf(input.retirement.employerMatch)).toBe(0);
    expect(input.equity).toEqual({ type: 'none' });
  });

  it('survives a JSON round trip unchanged', () => {
    const input = defaultCompensationInput();
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);
  });

  it('holds no value JSON would silently drop', () => {
    // `undefined`, a function, or a `Date` all survive typechecking and all
    // break the round trip above in ways that only show up on restore.
    const walk = (value: unknown, path: string): void => {
      if (value === null) return;
      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
        return;
      }
      if (typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) walk(entry, `${path}.${key}`);
        return;
      }
      expect(['string', 'number', 'boolean'], `${path} is a ${typeof value}`).toContain(
        typeof value
      );
    };
    walk(defaultCompensationInput(), 'input');
  });

  it('returns a fresh object each call, so two resets do not alias', () => {
    const first = defaultCompensationInput();
    const second = defaultCompensationInput();
    expect(first).not.toBe(second);
    expect(first.hours).not.toBe(second.hours);
  });
});

describe('patch actions', () => {
  it('changes one field and leaves every other group identical', () => {
    const before = defaultCompensationInput();
    const after = inputReducer(before, { type: 'patchCash', patch: { baseSalary: 180_000 } });

    expect(after.cash.baseSalary).toBe(180_000);
    expect(after.cash.bonusTargetPct).toBe(before.cash.bonusTargetPct);
    expect(after.hours).toBe(before.hours);
    expect(after.health).toBe(before.health);
  });

  it('never mutates the state it was given', () => {
    const before = defaultCompensationInput();
    const snapshot = structuredClone(before);

    const actions: InputAction[] = [
      { type: 'patchHours', patch: { hoursPerWeek: 45 } },
      { type: 'patchCash', patch: { baseSalary: 180_000 } },
      { type: 'patchHealth', patch: { employerPremiumContribution: 14_000 } },
      { type: 'patchTax', patch: { combinedMarginalRate: 0.32 } },
      { type: 'patchPerks', patch: { meals: { enabled: true, valuePerDay: 15 } } },
      { type: 'patchInsurance', patch: { disabilityPremium: 400 } },
      { type: 'patchLeave', patch: { parentalLeaveWeeks: 12 } },
      { type: 'patchRetirement', patch: { matchVestingYears: 3 } },
      { type: 'setEquity', equity: { type: 'unknown' } },
      { type: 'setPtoPlan', ptoPlan: { type: 'unlimited', expectedDaysTaken: 15 } },
      { type: 'setEmployerMatch', employerMatch: { type: 'amount', annualAmount: 7_200 } },
    ];

    for (const action of actions) inputReducer(before, action);
    expect(before).toEqual(snapshot);
  });

  it('keeps the result serializable after a run of edits', () => {
    const edited = [
      { type: 'patchCash', patch: { baseSalary: 180_000 } },
      { type: 'patchHours', patch: { hoursPerWeek: 45 } },
      {
        type: 'setEquity',
        equity: {
          type: 'public',
          grantShares: 100_000,
          pricePerShare: 1,
          vestYears: 4,
          cliffMonths: 12,
        },
      },
    ] satisfies InputAction[];

    const final = edited.reduce(inputReducer, defaultCompensationInput());
    expect(JSON.parse(JSON.stringify(final))).toEqual(final);
  });
});

describe('union actions', () => {
  it('replaces a PTO plan whole, so no value contradicts its own tag', () => {
    const before = defaultCompensationInput();
    const after = inputReducer(before, {
      type: 'setPtoPlan',
      ptoPlan: { type: 'unlimited', expectedDaysTaken: 18 },
    });

    expect(after.hours.ptoPlan).toEqual({ type: 'unlimited', expectedDaysTaken: 18 });
    // The accrual-only fields are gone rather than lingering alongside the new
    // tag — which is the entire reason this is not a patch action.
    expect(after.hours.ptoPlan).not.toHaveProperty('ptoDays');
  });

  it('writes the day count into whichever field the current mode uses', () => {
    const accrual = { type: 'accrual', ptoDays: 15, expectedAccruedBalanceDays: 5 } as const;
    expect(withPtoDays(accrual, 20)).toEqual({
      type: 'accrual',
      ptoDays: 20,
      expectedAccruedBalanceDays: 5,
    });

    const unlimited = { type: 'unlimited', expectedDaysTaken: 15 } as const;
    expect(withPtoDays(unlimited, 20)).toEqual({ type: 'unlimited', expectedDaysTaken: 20 });
  });

  it('reports no dollar match for a percent-of-base plan', () => {
    // A percentage has no dollar figure without a salary, and inventing one
    // here would be the UI asserting something it cannot know.
    expect(matchAmountOf({ type: 'percent_of_base', percentOfBase: 0.04, capDollars: null })).toBe(
      0
    );
  });
});

describe('reset and replace', () => {
  it('reset discards every edit', () => {
    const edited = inputReducer(defaultCompensationInput(), {
      type: 'patchCash',
      patch: { baseSalary: 180_000 },
    });
    expect(inputReducer(edited, { type: 'reset' })).toEqual(defaultCompensationInput());
  });

  it('replace adopts a whole input, which is what a restored save looks like', () => {
    const restored = {
      ...defaultCompensationInput(),
      cash: { ...defaultCompensationInput().cash, baseSalary: 99_000 },
    };
    expect(inputReducer(defaultCompensationInput(), { type: 'replace', input: restored })).toBe(
      restored
    );
  });
});

describe('switching how the employer match is stated', () => {
  // The point of the percentage form is that the user does not do this
  // arithmetic. If a conversion lost or invented a number, the field would
  // quietly disagree with the breakdown beside it.

  it('turns a percentage into the dollars the engine was already using', () => {
    const match = asAmountMatch(
      { type: 'percent_of_base', percentOfBase: 0.035, capDollars: null },
      180_000
    );
    expect(match).toEqual({ type: 'amount', annualAmount: 6_300 });
  });

  it('applies the cap when converting to dollars', () => {
    const match = asAmountMatch(
      { type: 'percent_of_base', percentOfBase: 0.04, capDollars: 5_000 },
      180_000
    );
    expect(matchAmountOf(match)).toBe(5_000);
  });

  it('turns dollars back into a percentage of base', () => {
    const match = asPercentMatch({ type: 'amount', annualAmount: 6_300 }, 180_000);
    expect(match).toEqual({ type: 'percent_of_base', percentOfBase: 0.035, capDollars: null });
  });

  it('round-trips without drift', () => {
    const start = { type: 'amount', annualAmount: 7_200 } as const;
    const round = asAmountMatch(asPercentMatch(start, 180_000), 180_000);
    expect(matchAmountOf(round)).toBeCloseTo(7_200, 6);
  });

  it('gives 0% rather than inventing one when there is no salary yet', () => {
    // The match field sits above the salary field in some people's filling
    // order. No percentage is implied by a dollar figure over an unknown base,
    // and putting a number there the user did not choose is worse than a zero.
    const match = asPercentMatch({ type: 'amount', annualAmount: 7_200 }, 0);
    expect(match).toEqual({ type: 'percent_of_base', percentOfBase: 0, capDollars: null });
  });

  it('is a no-op when the match is already in that form', () => {
    const percent = { type: 'percent_of_base', percentOfBase: 0.04, capDollars: 5_000 } as const;
    const amount = { type: 'amount', annualAmount: 7_200 } as const;
    expect(asPercentMatch(percent, 180_000)).toBe(percent);
    expect(asAmountMatch(amount, 180_000)).toBe(amount);
  });

  it("never leaves a value carrying the other form's fields", () => {
    // The failure mode a patched union produces, and the one the storage guard
    // also rejects: a value that contradicts its own tag.
    const match = asPercentMatch({ type: 'amount', annualAmount: 7_200 }, 180_000);
    expect(match).not.toHaveProperty('annualAmount');
    expect(asAmountMatch(match, 180_000)).not.toHaveProperty('percentOfBase');
  });
});
