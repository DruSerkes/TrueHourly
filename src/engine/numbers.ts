/**
 * Numeric guards used across the engine.
 *
 * These exist for one reason: DESIGN.md §4 Fixture C and CLAUDE.md's "never
 * render NaN" rule. Input reaches the engine from a `localStorage` restore
 * (DESIGN.md §5) and, in v2, from a URL fragment — both can hand us a number
 * field holding `NaN`, `Infinity`, or a negative where only a count makes
 * sense. The engine's contract is that it always returns a finite result, so
 * every arithmetic entry point launders its inputs through here.
 *
 * This is deliberately NOT validation. Validation rejects; these functions
 * substitute a defensible value and keep going, because a half-filled form must
 * still produce a number.
 */

/**
 * `value` if it is a finite number, otherwise `fallback`.
 * Catches `NaN`, `Infinity`, `-Infinity`, and non-number values that slipped
 * past the type system via `JSON.parse`.
 */
export function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** `value` clamped to `[min, max]`. Non-finite input yields `min`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(finite(value, min), min), max);
}

/** A finite count that cannot go below zero — days, hours, weeks, dollars. */
export function nonNegative(value: number): number {
  return Math.max(finite(value, 0), 0);
}

/**
 * Round to whole dollars. Money is stored as whole dollars per year throughout
 * the engine (CLAUDE.md "Conventions"), so line-item face values round here
 * rather than at the render boundary. Salary-equivalent figures are NOT rounded
 * — a gross-up is a derived ratio and `LineItem.salaryEquivalent` is documented
 * as possibly fractional.
 */
export function dollars(value: number): number {
  return Math.round(finite(value, 0));
}
