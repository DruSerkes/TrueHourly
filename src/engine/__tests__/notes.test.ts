/**
 * Off-headline notes (DESIGN.md §2.6).
 *
 * The load-bearing test in this file is `never affects a total`. Everything
 * else here is detail; that one is the reason notes are a separate array rather
 * than line items with a flag. A PTO payout is real money, and the moment it
 * reaches `totals` the headline is wrong in the same way a PTO line item would
 * make it wrong (invariant 2) — a one-time asset divided by annual hours.
 */

import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate.ts';
import { computeNotes, dailyRateFor } from '../notes.ts';
import { computeHours } from '../hours.ts';
import type { CompensationInput, Note, TrueHourlyResult } from '../types.ts';
import { defaultCash, defaultHours, defaultInput, defaultRetirement } from './_input.ts';

/** A $180,000 package; overrides go on top. */
function pkg(overrides: Partial<CompensationInput> = {}): CompensationInput {
  return defaultInput({ cash: { ...defaultCash(), baseSalary: 180_000 }, ...overrides });
}

function find(result: TrueHourlyResult, id: string): Note | undefined {
  return result.notes.find((note) => note.id === id);
}

function accrualPkg(expectedAccruedBalanceDays: number): CompensationInput {
  return pkg({
    hours: {
      ...defaultHours(),
      ptoPlan: { type: 'accrual', ptoDays: 20, expectedAccruedBalanceDays },
    },
  });
}

describe('notes never affect a total (DESIGN.md §2.6)', () => {
  const withBalance = calculate(accrualPkg(15));
  const withoutBalance = calculate(accrualPkg(0));

  it('leaves every headline figure identical when a payout appears', () => {
    // The only difference between these two inputs is a 15-day accrued balance,
    // worth over $10,000. Nothing in the headline may move.
    expect(withBalance.totals.faceValue).toBe(withoutBalance.totals.faceValue);
    expect(withBalance.totals.salaryEquivalent).toBe(withoutBalance.totals.salaryEquivalent);
    expect(withBalance.trueHourly.faceValue).toBe(withoutBalance.trueHourly.faceValue);
    expect(withBalance.trueHourly.salaryEquivalent).toBe(
      withoutBalance.trueHourly.salaryEquivalent
    );
  });

  it('puts the payout figure in the note, so it is not simply missing', () => {
    expect(find(withBalance, 'pto-separation-payout')?.amount).toBeGreaterThan(10_000);
  });

  it('emits no line item for any note', () => {
    const itemIds = new Set(withBalance.lineItems.map((item) => item.id));
    for (const note of withBalance.notes) {
      expect(itemIds.has(note.id)).toBe(false);
    }
  });

  it('keeps the totals equal to the line items alone', () => {
    const summed = withBalance.lineItems.reduce((sum, item) => sum + item.annualValue, 0);
    expect(withBalance.totals.faceValue).toBe(summed);
  });
});

describe('PTO payout at separation (DESIGN.md §2.6)', () => {
  it('is dailyRate x accrued balance', () => {
    // 180,000 / (5 x 52) = 692.31 a day; x 10 days = 6,923.
    expect(dailyRateFor(180_000, computeHours(defaultHours()))).toBeCloseTo(692.31, 2);
    expect(find(calculate(accrualPkg(10)), 'pto-separation-payout')?.amount).toBe(6_923);
  });

  it('uses scheduled days, not days worked', () => {
    // Dividing by `daysWorked` (229) instead of 260 would inflate the rate by
    // exactly the time off — and the balance is denominated in those same days.
    const hours = computeHours(defaultHours());
    expect(dailyRateFor(180_000, hours)).toBeLessThan(180_000 / hours.daysWorked);
  });

  it('is estimated, not entered — the daily rate is the app’s own derivation', () => {
    expect(find(calculate(accrualPkg(10)), 'pto-separation-payout')?.confidence).toBe('estimated');
  });

  it('is $0 under an unlimited plan, and says why', () => {
    const unlimited = calculate(
      pkg({
        hours: { ...defaultHours(), ptoPlan: { type: 'unlimited', expectedDaysTaken: 15 } },
      })
    );
    const note = find(unlimited, 'pto-separation-payout');

    expect(note?.amount).toBe(0);
    expect(note?.body).toContain('nothing to pay out');
  });

  it('is present even with a zero balance, so the card can prompt for one', () => {
    expect(find(calculate(accrualPkg(0)), 'pto-separation-payout')?.amount).toBe(0);
  });

  it('is $0 at a $0 salary rather than NaN', () => {
    expect(find(calculate(defaultInput()), 'pto-separation-payout')?.amount).toBe(0);
  });
});

describe('401(k) vesting schedule (DESIGN.md §2.6)', () => {
  const vesting = pkg({ retirement: { ...defaultRetirement(), matchVestingYears: 4 } });

  it('appears when a vesting period is entered', () => {
    expect(find(calculate(vesting), 'retirement-vesting-schedule')).toBeDefined();
  });

  it('asks the cliff-vs-graded question, which the app cannot answer itself', () => {
    expect(find(calculate(vesting), 'retirement-vesting-schedule')?.body).toContain('graded');
  });

  it('is absent with immediate vesting', () => {
    expect(find(calculate(pkg()), 'retirement-vesting-schedule')).toBeUndefined();
  });
});

describe('equity cliff (DESIGN.md §2.6)', () => {
  function withCliff(cliffMonths: number): CompensationInput {
    return pkg({
      equity: {
        type: 'public',
        grantShares: 1_000,
        pricePerShare: 100,
        vestYears: 4,
        cliffMonths,
      },
    });
  }

  it('appears when the grant has a cliff', () => {
    expect(find(calculate(withCliff(12)), 'equity-cliff')?.body).toContain('12 months');
  });

  it('is absent without one', () => {
    expect(find(calculate(withCliff(0)), 'equity-cliff')).toBeUndefined();
  });

  it('is absent when there is no equity to have a cliff', () => {
    expect(find(calculate(pkg()), 'equity-cliff')).toBeUndefined();
  });

  it('appears for options and private grants too', () => {
    const options = pkg({
      equity: {
        type: 'options',
        grantShares: 4_000,
        strikePrice: 2,
        fairMarketValue: 10,
        vestYears: 4,
        cliffMonths: 18,
        optionClass: 'iso',
      },
    });
    expect(find(calculate(options), 'equity-cliff')?.body).toContain('18 months');
  });
});

describe('the unconditional prompt cards (DESIGN.md §2.6)', () => {
  const result = calculate(pkg());

  // Unconditional on purpose: the app cannot price any of these without
  // inventing figures (invariant 5), and a card that only appeared once the
  // user had thought to enter something would never prompt anybody.
  it.each(['severance-policy', 'on-call-burden', 'remote-vs-in-office'])(
    '%s is always present',
    (id) => {
      expect(find(result, id)).toBeDefined();
    }
  );

  it('marks the unpriceable ones unknown rather than estimated', () => {
    expect(find(result, 'severance-policy')?.confidence).toBe('unknown');
    expect(find(result, 'on-call-burden')?.confidence).toBe('unknown');
  });

  it('carries no dollar figure for a card it cannot price', () => {
    expect(find(result, 'severance-policy')?.amount).toBeUndefined();
    expect(find(result, 'on-call-burden')?.amount).toBeUndefined();
  });

  it('quantifies the commute when the user entered one', () => {
    // 45 minutes each way x 229 days worked = about 344 hours a year.
    const commuting = calculate(
      pkg({
        hours: {
          ...defaultHours(),
          ptoPlan: { type: 'accrual', ptoDays: 20, expectedAccruedBalanceDays: 0 },
          commuteMinutesOneWay: 45,
        },
      })
    );
    const note = find(commuting, 'remote-vs-in-office');

    expect(note?.body).toContain('45-minute commute');
    expect(note?.body).toContain('344 hours a year');
    expect(note?.confidence).toBe('entered');
  });

  it('still explains the exclusion when no commute was entered', () => {
    expect(find(result, 'remote-vs-in-office')?.body).toContain('left out of the headline');
  });
});

describe('note shape', () => {
  const result = calculate(
    pkg({
      equity: {
        type: 'public',
        grantShares: 1_000,
        pricePerShare: 100,
        vestYears: 4,
        cliffMonths: 12,
      },
      retirement: { ...defaultRetirement(), matchVestingYears: 4 },
    })
  );

  it('emits every id at most once', () => {
    const ids = result.notes.map((note) => note.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every note an id, a title, a body and a confidence', () => {
    for (const note of result.notes) {
      expect(note.id).toMatch(/^[a-z0-9-]+$/);
      expect(note.title.length).toBeGreaterThan(0);
      expect(note.body.length).toBeGreaterThan(20);
      expect(['entered', 'estimated', 'unknown']).toContain(note.confidence);
    }
  });

  it('never carries a non-finite amount, even on absurd input', () => {
    const absurd = computeNotes(
      defaultInput({
        hours: {
          ...defaultHours(),
          daysPerWeek: 0,
          ptoPlan: {
            type: 'accrual',
            ptoDays: Number.NaN,
            expectedAccruedBalanceDays: Number.POSITIVE_INFINITY,
          },
          commuteMinutesOneWay: Number.NaN,
        },
        cash: { ...defaultCash(), baseSalary: Number.NaN },
      }),
      computeHours({ ...defaultHours(), daysPerWeek: 0 })
    );

    for (const note of absurd) {
      if (note.amount !== undefined) expect(Number.isFinite(note.amount)).toBe(true);
    }
  });
});
