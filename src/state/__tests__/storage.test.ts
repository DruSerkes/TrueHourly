/**
 * The autosave guard (DESIGN.md §5).
 *
 * What is being tested here is not really the happy path — a round-trip through
 * `JSON` is not where this breaks. It is the five ways the read can be handed
 * something it did not write: nothing, a stale version, invalid JSON, a blob
 * missing fields, and a storage that throws rather than answering. Every one of
 * them has to produce `null` and no exception, because the caller's only
 * recovery is to fall back to defaults and the app has to keep working.
 *
 * `FakeStorage` rather than jsdom: these are pure functions over a three-method
 * interface, and a fake lets a *throwing* storage be tested, which is a real
 * runtime state (disabled by policy, quota exhausted) and the one no DOM
 * implementation will reproduce on demand.
 */

import { describe, expect, it } from 'vitest';
import { defaultCompensationInput } from '../defaults.ts';
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  clearSavedInput,
  isSavedInput,
  loadSavedInput,
  saveInput,
} from '../storage.ts';
import type { StorageLike } from '../storage.ts';
import type { CompensationInput } from '../../engine/types.ts';

type Operation = 'get' | 'set' | 'remove';

class FakeStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  private readonly throwOn: ReadonlySet<Operation>;

  // A plain assignment rather than a parameter property: `erasableSyntaxOnly`
  // forbids the shorthand, because it is TypeScript syntax that emits code.
  constructor(throwOn: ReadonlySet<Operation> = new Set()) {
    this.throwOn = throwOn;
  }

  getItem(key: string): string | null {
    if (this.throwOn.has('get')) throw new Error('storage disabled');
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOn.has('set')) throw new Error('quota exceeded');
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOn.has('remove')) throw new Error('storage disabled');
    this.map.delete(key);
  }

  /** Put a raw string in directly, bypassing `saveInput`. */
  seed(raw: string): void {
    this.map.set(STORAGE_KEY, raw);
  }

  has(): boolean {
    return this.map.has(STORAGE_KEY);
  }
}

/** The defaults, with a salary — anything that is not the untouched form. */
function withSalary(baseSalary: number): CompensationInput {
  const input = defaultCompensationInput();
  input.cash.baseSalary = baseSalary;
  return input;
}

describe('saveInput / loadSavedInput round-trip', () => {
  it('restores an input unchanged', () => {
    const storage = new FakeStorage();
    const input = defaultCompensationInput();
    input.cash.baseSalary = 180_000;
    input.hours.hoursPerWeek = 45;
    input.tax.combinedMarginalRate = 0.32;

    expect(saveInput(input, storage)).toBe(true);
    expect(loadSavedInput(storage)).toEqual(input);
  });

  it('restores every field, not just the ones the UI shows', () => {
    // The autosave claim is "reload and your inputs are exactly as you left
    // them". A guard that accepted the blob but dropped a key would still pass
    // a spot check of the headline fields, so this asserts deep equality over
    // a fully-populated input instead.
    const storage = new FakeStorage();
    const input: CompensationInput = {
      ...defaultCompensationInput(),
      equity: {
        type: 'private',
        grantShares: 50_000,
        lastPreferredPricePerShare: 4.5,
        vestYears: 4,
        cliffMonths: 12,
        commonDiscount: 0.3,
        expectedDilution: 0.25,
        strongMultiple: 3,
        stage: 'series_b',
        liquidityProbability: null,
        showExpectedValue: true,
      },
    };
    input.retirement.employerMatch = {
      type: 'percent_of_base',
      percentOfBase: 0.04,
      capDollars: null,
    };
    input.retirement.espp = { annualContribution: 10_000, discountRate: 0.15, hasLookback: true };
    input.hours.ptoPlan = { type: 'unlimited', expectedDaysTaken: 18 };

    saveInput(input, storage);
    expect(loadSavedInput(storage)).toEqual(input);
  });

  it('writes the current version alongside the input', () => {
    const storage = new FakeStorage();
    saveInput(withSalary(180_000), storage);
    // Read through the fake rather than through `loadSavedInput`, so the
    // envelope itself is asserted and not just its payload.
    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ version: STORAGE_VERSION });
  });
});

describe('loadSavedInput rejects what it cannot trust', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadSavedInput(new FakeStorage())).toBeNull();
  });

  it('returns null when storage is unavailable', () => {
    expect(loadSavedInput(null)).toBeNull();
  });

  it('returns null on a stale version', () => {
    const storage = new FakeStorage();
    storage.seed(
      JSON.stringify({ version: STORAGE_VERSION + 1, input: defaultCompensationInput() })
    );
    expect(loadSavedInput(storage)).toBeNull();
  });

  it('returns null when the version is missing entirely', () => {
    const storage = new FakeStorage();
    storage.seed(JSON.stringify({ input: defaultCompensationInput() }));
    expect(loadSavedInput(storage)).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    const storage = new FakeStorage();
    storage.seed('{"version":1,"input":{');
    expect(loadSavedInput(storage)).toBeNull();
  });

  it('returns null on JSON that is valid but not an object', () => {
    for (const raw of ['null', '42', '"nope"', '[]']) {
      const storage = new FakeStorage();
      storage.seed(raw);
      expect(loadSavedInput(storage)).toBeNull();
    }
  });

  it('returns null when a whole group is missing', () => {
    for (const group of [
      'hours',
      'cash',
      'equity',
      'retirement',
      'health',
      'insurance',
      'perks',
      'leave',
      'tax',
    ] as const) {
      const input: Record<string, unknown> = { ...defaultCompensationInput() };
      delete input[group];
      const storage = new FakeStorage();
      storage.seed(JSON.stringify({ version: STORAGE_VERSION, input }));
      expect(loadSavedInput(storage), `missing ${group}`).toBeNull();
    }
  });

  it('does not throw when storage throws on read', () => {
    const storage = new FakeStorage(new Set(['get']));
    expect(() => loadSavedInput(storage)).not.toThrow();
    expect(loadSavedInput(storage)).toBeNull();
  });
});

describe('isSavedInput', () => {
  function withInput(mutate: (input: CompensationInput) => void): unknown {
    const input = defaultCompensationInput();
    mutate(input);
    return input;
  }

  it('accepts a default input', () => {
    expect(isSavedInput(defaultCompensationInput())).toBe(true);
  });

  it('rejects a missing numeric leaf', () => {
    const input: Record<string, unknown> = { ...defaultCompensationInput() };
    input.cash = { bonusTargetPct: 0 }; // baseSalary gone
    expect(isSavedInput(input)).toBe(false);
  });

  it('rejects a numeric field holding a string', () => {
    // The realistic shape of this one is a hand-edited blob or a future save
    // format that quoted its numbers. `'180000' / 2080` is `86.5`, so it would
    // not even fail loudly — it would just silently work until it did not.
    expect(isSavedInput(withInput((i) => Object.assign(i.cash, { baseSalary: '180000' })))).toBe(
      false
    );
  });

  it('rejects NaN and Infinity', () => {
    // These cannot survive `JSON.stringify` — both serialize to `null` — so the
    // guard sees `null` in a number's place. Which it must still refuse,
    // because `null` in the arithmetic is a silent zero rather than an error.
    expect(isSavedInput(withInput((i) => Object.assign(i.hours, { hoursPerWeek: NaN })))).toBe(
      false
    );
    expect(isSavedInput(withInput((i) => Object.assign(i.hours, { hoursPerWeek: Infinity })))).toBe(
      false
    );
    expect(isSavedInput(withInput((i) => Object.assign(i.hours, { hoursPerWeek: null })))).toBe(
      false
    );
  });

  it('accepts null only where the type means "derive"', () => {
    expect(
      isSavedInput(withInput((i) => Object.assign(i.hours, { hoursWorkedOverride: null })))
    ).toBe(true);
    expect(
      isSavedInput(withInput((i) => Object.assign(i.hours, { hoursWorkedOverride: 2000 })))
    ).toBe(true);
  });

  it('accepts both PTO plan modes and rejects a third', () => {
    expect(
      isSavedInput(
        withInput((i) => {
          i.hours.ptoPlan = { type: 'unlimited', expectedDaysTaken: 15 };
        })
      )
    ).toBe(true);
    expect(
      isSavedInput(
        withInput((i) => {
          Object.assign(i.hours, { ptoPlan: { type: 'flexible', ptoDays: 20 } });
        })
      )
    ).toBe(false);
  });

  it('rejects a PTO plan whose fields belong to the other mode', () => {
    // The exact shape a patched union produces, which is why the reducer
    // replaces unions whole. If it ever regresses, the save is where the
    // contradiction surfaces.
    expect(
      isSavedInput(
        withInput((i) => {
          Object.assign(i.hours, { ptoPlan: { type: 'accrual', expectedDaysTaken: 15 } });
        })
      )
    ).toBe(false);
  });

  it('accepts all five equity modes', () => {
    const modes: CompensationInput['equity'][] = [
      { type: 'none' },
      { type: 'unknown' },
      { type: 'public', grantShares: 100_000, pricePerShare: 1, vestYears: 4, cliffMonths: 12 },
      {
        type: 'private',
        grantShares: 1,
        lastPreferredPricePerShare: 1,
        vestYears: 4,
        cliffMonths: 12,
        commonDiscount: 0.3,
        expectedDilution: 0.25,
        strongMultiple: 3,
        stage: null,
        liquidityProbability: null,
        showExpectedValue: false,
      },
      {
        type: 'options',
        grantShares: 1,
        strikePrice: 1,
        fairMarketValue: 2,
        vestYears: 4,
        cliffMonths: 0,
        optionClass: 'iso',
      },
    ];
    for (const equity of modes) {
      expect(isSavedInput(withInput((i) => (i.equity = equity))), equity.type).toBe(true);
    }
  });

  it('rejects an unrecognized equity mode', () => {
    expect(isSavedInput(withInput((i) => Object.assign(i, { equity: { type: 'crypto' } })))).toBe(
      false
    );
  });

  it('accepts a null ESPP but not a malformed one', () => {
    expect(isSavedInput(withInput((i) => (i.retirement.espp = null)))).toBe(true);
    expect(
      isSavedInput(withInput((i) => Object.assign(i.retirement, { espp: { discountRate: 0.15 } })))
    ).toBe(false);
  });

  it('rejects a non-boolean where the type says boolean', () => {
    expect(isSavedInput(withInput((i) => Object.assign(i.perks.meals, { enabled: 'yes' })))).toBe(
      false
    );
  });
});

describe('saveInput and clearSavedInput survive hostile storage', () => {
  it('reports failure rather than throwing when the write throws', () => {
    const storage = new FakeStorage(new Set(['set']));
    expect(() => saveInput(withSalary(180_000), storage)).not.toThrow();
    expect(saveInput(withSalary(180_000), storage)).toBe(false);
  });

  it('reports failure when there is no storage at all', () => {
    expect(saveInput(withSalary(180_000), null)).toBe(false);
  });

  it('writes no save for an untouched input, so a reset really does erase it', () => {
    // The footer tells the user that resetting erases the saved copy. Reset
    // clears it, and then the debounced autosave arrives holding the defaults
    // — so this is the assertion that keeps the sentence true.
    const storage = new FakeStorage();
    saveInput(withSalary(180_000), storage);
    expect(storage.has()).toBe(true);

    expect(saveInput(defaultCompensationInput(), storage)).toBe(true);
    expect(storage.has()).toBe(false);
  });

  it('removes the save', () => {
    const storage = new FakeStorage();
    saveInput(withSalary(180_000), storage);
    expect(storage.has()).toBe(true);

    clearSavedInput(storage);
    expect(storage.has()).toBe(false);
    expect(loadSavedInput(storage)).toBeNull();
  });

  it('does not throw when the remove throws, or when there is no storage', () => {
    expect(() => clearSavedInput(new FakeStorage(new Set(['remove'])))).not.toThrow();
    expect(() => clearSavedInput(null)).not.toThrow();
  });
});
