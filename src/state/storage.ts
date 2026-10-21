/**
 * `localStorage` autosave (DESIGN.md §5).
 *
 * Two jobs, and the second one is the hard one: write the input after every
 * change, and read back something that may be years old, hand-edited, or
 * written by a version of this app that no longer exists.
 *
 * ── Why the guard is hand-written ───────────────────────────────────────
 *
 * DESIGN.md §5 says "no validation library — the guard is ~10 lines", and the
 * reason is scope rather than dependency aversion. The only producer of this
 * blob is this app on this origin, so the realistic failure modes are a stale
 * `version` and a half-written value, not an adversary. A URL-shared input is
 * the untrusted case, and §8 queues Zod for exactly that point.
 *
 * What the guard checks is therefore narrow and deliberate: the version, and
 * that every leaf the engine will divide by is a finite number. It does NOT
 * check ranges — the engine launders its own inputs (`nonNegative`, `clamp`)
 * and Fixture C is the test that a degenerate input cannot produce `NaN`. A
 * guard that re-asserted those bounds would be a second, quietly diverging copy
 * of rules that already live in one place.
 *
 * ── Why every access is wrapped ─────────────────────────────────────────
 *
 * `localStorage` is not a plain object. Reading it throws outright in a Chrome
 * window with third-party cookies blocked in some embedding contexts, Safari
 * private browsing historically threw on *write* once the quota hit zero, and
 * any of it can be disabled by policy. None of that is exotic enough to let it
 * break a calculator, so every path here is wrapped and every failure
 * degrades to "no save" rather than to an exception.
 */

import { defaultCompensationInput } from './defaults.ts';
import type { CompensationInput } from '../engine/types.ts';

/** The key the save lives under. Namespaced so it cannot collide on localhost. */
export const STORAGE_KEY = 'true-hourly:input';

/**
 * Bumped whenever the shape of `CompensationInput` changes.
 *
 * A returning visitor holding version 1 after the shape has moved on gets clean
 * defaults, not broken math — which is the entire reason this is a number and
 * not an absent field (DESIGN.md §5).
 */
export const STORAGE_VERSION = 1;

/** What gets written. */
export interface SavedState {
  version: number;
  input: CompensationInput;
}

/**
 * The slice of the `Storage` interface used here.
 *
 * Narrowed to three methods and injectable so the guard can be tested against
 * a storage that throws, which is a documented runtime state and not a
 * hypothetical. Tests pass a fake; the app passes nothing.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The real `localStorage`, or `null` if touching it throws or it is absent.
 *
 * Absent rather than merely empty under Vitest's `node` environment, which is
 * also why this is a function and not a module-level constant.
 */
function defaultStorage(): StorageLike | null {
  try {
    const candidate = globalThis.localStorage;
    return candidate as StorageLike | null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite number. Rejects `NaN`, both infinities, and numeric strings. */
function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A finite number, or `null` where the type says `null` means "derive". */
function isNumberOrNull(value: unknown): boolean {
  return value === null || isNumber(value);
}

/** Every key present on `group` and holding a finite number. */
function hasNumbers(group: unknown, keys: readonly string[]): boolean {
  if (!isObject(group)) return false;
  return keys.every((key) => isNumber(group[key]));
}

/**
 * The PTO plan, which is a discriminated union: the days field means a
 * different thing in each mode, so neither name is required in both.
 */
function isPtoPlan(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (value.type === 'accrual') return hasNumbers(value, ['ptoDays', 'expectedAccruedBalanceDays']);
  if (value.type === 'unlimited') return hasNumbers(value, ['expectedDaysTaken']);
  return false;
}

function isEmployerMatch(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (value.type === 'amount') return hasNumbers(value, ['annualAmount']);
  if (value.type === 'percent_of_base')
    return isNumber(value.percentOfBase) && isNumberOrNull(value.capDollars);
  return false;
}

/**
 * Equity, discriminated over five modes.
 *
 * `none` and `unknown` carry no fields at all, which is the case a
 * required-keys check would get wrong if it were written generically — hence
 * the explicit switch.
 */
function isEquity(value: unknown): boolean {
  if (!isObject(value)) return false;
  switch (value.type) {
    case 'none':
    case 'unknown':
      return true;
    case 'public':
      return hasNumbers(value, ['grantShares', 'pricePerShare', 'vestYears', 'cliffMonths']);
    case 'private':
      return (
        hasNumbers(value, [
          'grantShares',
          'lastPreferredPricePerShare',
          'vestYears',
          'cliffMonths',
          'commonDiscount',
          'expectedDilution',
          'strongMultiple',
        ]) &&
        isNumberOrNull(value.liquidityProbability) &&
        typeof value.showExpectedValue === 'boolean'
      );
    case 'options':
      return hasNumbers(value, [
        'grantShares',
        'strikePrice',
        'fairMarketValue',
        'vestYears',
        'cliffMonths',
      ]);
    default:
      return false;
  }
}

function isEspp(value: unknown): boolean {
  if (value === null) return true;
  return hasNumbers(value, ['annualContribution', 'discountRate']);
}

/**
 * Whether a parsed blob is close enough to a `CompensationInput` to hand to the
 * engine.
 *
 * The cast at the end is the one unchecked step in the file, and it is narrowed
 * to what the engine actually consumes: every numeric leaf it divides by or
 * sums has been verified above. String-typed enum fields (`bonusTreatment`,
 * `coverageTier`, `stipendTaxTreatment`, `optionClass`, `stage`) are
 * deliberately not checked, because each is read through an equality test in
 * the engine — `=== 'earned'`, `=== 'family'` — so an unrecognized value lands
 * on the documented default instead of propagating. A bad *number* is the only
 * thing that can reach the arithmetic.
 */
export function isSavedInput(value: unknown): value is CompensationInput {
  if (!isObject(value)) return false;

  const { hours, cash, equity, retirement, health, insurance, perks, leave, tax } = value;

  return (
    hasNumbers(hours, [
      'hoursPerWeek',
      'daysPerWeek',
      'holidayDays',
      'unpaidLeaveDays',
      'sabbaticalWeeks',
      'sabbaticalCycleYears',
      'commuteMinutesOneWay',
    ]) &&
    isObject(hours) &&
    isNumberOrNull(hours.hoursWorkedOverride) &&
    isPtoPlan(hours.ptoPlan) &&
    hasNumbers(cash, [
      'baseSalary',
      'bonusTargetPct',
      'signOnBonus',
      'expectedTenureYears',
      'signOnClawbackMonths',
    ]) &&
    isEquity(equity) &&
    isObject(retirement) &&
    hasNumbers(retirement, ['matchVestingYears', 'profitSharing', 'studentLoanMatch']) &&
    isEmployerMatch(retirement.employerMatch) &&
    isEspp(retirement.espp) &&
    hasNumbers(health, [
      'employerPremiumContribution',
      'employerHsaContribution',
      'employerFsaSeed',
    ]) &&
    hasNumbers(insurance, ['lifeAndAddPremium', 'lifeCoverageAmount', 'disabilityPremium']) &&
    isObject(perks) &&
    hasNumbers(perks, [
      'commuterBenefitMonthly',
      'tuitionReimbursement',
      'homeOfficeStipend',
      'wellnessStipend',
      'professionalDevelopment',
    ]) &&
    isObject(perks.meals) &&
    isNumber(perks.meals.valuePerDay) &&
    typeof perks.meals.enabled === 'boolean' &&
    hasNumbers(leave, ['parentalLeaveWeeks', 'parentalLeaveWeeklyRate']) &&
    hasNumbers(tax, ['combinedMarginalRate', 'deferredRate'])
  );
}

// ---------------------------------------------------------------------------
// Read / write / clear
// ---------------------------------------------------------------------------

/**
 * The saved input, or `null` if there isn't a usable one.
 *
 * `null` covers every failure identically — no storage, nothing saved,
 * unparseable JSON, a stale version, a wrong shape — because the caller's
 * response to all of them is the same: start from defaults. Distinguishing them
 * would only be useful if the app could repair one, and it cannot.
 */
export function loadSavedInput(
  storage: StorageLike | null = defaultStorage()
): CompensationInput | null {
  if (storage === null) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(parsed)) return null;
  if (parsed.version !== STORAGE_VERSION) return null;
  if (!isSavedInput(parsed.input)) return null;

  return parsed.input;
}

/**
 * Write the input. Returns whether it landed, for the UI's own honesty — a page
 * that says "saved in this browser" while storage is disabled is lying.
 */
export function saveInput(
  input: CompensationInput,
  storage: StorageLike | null = defaultStorage()
): boolean {
  if (storage === null) return false;
  try {
    const serialized = JSON.stringify(input);

    // An input that is exactly the defaults is not worth keeping, and keeping
    // it would make the page lie. Reset-to-defaults clears the save, then the
    // debounced autosave fires 500ms later with the fresh defaults in hand —
    // so without this, "Reset erases the saved copy" would be true for half a
    // second. Removing instead of writing makes the claim hold.
    //
    // Key order is stable: the reducer spreads existing objects, so a patched
    // input keeps the order `defaultCompensationInput` built it in. If that
    // ever stops being true the comparison simply fails and a defaults-only
    // blob gets written, which is the behaviour this replaces rather than a
    // new failure.
    if (serialized === JSON.stringify(defaultCompensationInput())) {
      storage.removeItem(STORAGE_KEY);
      return true;
    }

    const payload: SavedState = { version: STORAGE_VERSION, input };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    // Quota exceeded, or storage disabled between load and now. Nothing to
    // recover: the app works without a save, which is the whole design.
    return false;
  }
}

/** Drop the save. Wired to reset-to-defaults (DESIGN.md §5). */
export function clearSavedInput(storage: StorageLike | null = defaultStorage()): void {
  if (storage === null) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Same reasoning as `saveInput`.
  }
}
