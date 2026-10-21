/**
 * The render boundary. Everything that turns a number into characters lives
 * here, and nothing here is ever called from inside a calculation.
 *
 * CLAUDE.md's convention — "format at the render boundary only, never inside
 * calculations" — exists because rounding is lossy and doing it early is how a
 * total stops matching the sum of its rows. `$248,635` and `$120.64` are the
 * same package at two precisions; the engine holds the unrounded figures and
 * these functions decide what a given slot can show.
 *
 * Why the precisions differ:
 *   - annual dollars are shown whole. A cent on a $248,635 package is noise,
 *     and the extra characters cost more than they tell anyone.
 *   - hourly dollars are shown to the cent, because that is the number the user
 *     came for and the fixtures in DESIGN.md §4 are stated to the cent.
 */

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const ONE_DECIMAL = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/**
 * Guard for every formatter below.
 *
 * The engine launders its inputs and should never hand out a `NaN`
 * (DESIGN.md Fixture C is the test for that), but "should never" is not a
 * reason to render the word `NaN` at someone who is trying to compare two job
 * offers. An em dash says "no value here" and is the right thing to show if
 * that guarantee ever breaks.
 */
function finiteOr(value: number, fallback: string): string | null {
  return Number.isFinite(value) ? null : fallback;
}

/** Annual dollars, whole: `$248,635`. */
export function formatDollars(value: number): string {
  return finiteOr(value, '—') ?? WHOLE_DOLLARS.format(value);
}

/** Dollars per hour, to the cent: `$120.64`. */
export function formatHourly(value: number): string {
  return finiteOr(value, '—') ?? CENTS.format(value);
}

/** A count of hours or days, whole: `2,061`. */
export function formatCount(value: number): string {
  return finiteOr(value, '—') ?? COUNT.format(value);
}

/** A count that can be fractional, to one decimal: `45.8`. */
export function formatDecimal(value: number): string {
  return finiteOr(value, '—') ?? ONE_DECIMAL.format(value);
}

/**
 * A decimal rate as a percentage: `0.32` → `32%`.
 *
 * One decimal place, dropped when it is zero, so `0.325` reads `32.5%` instead
 * of rounding to a figure the user did not choose.
 */
export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  return `${ONE_DECIMAL.format(rate * 100)}%`;
}

/**
 * What a currency field shows when it is not being typed in.
 *
 * Grouped but with no `$`, because the symbol is rendered as a fixed prefix
 * beside the input instead: inside the value it would be re-parsed on the next
 * keystroke, and a field whose own output it has to tolerate as input is a
 * field that will eventually disagree with itself.
 */
export function formatFieldValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '';
  return COUNT.format(value);
}
