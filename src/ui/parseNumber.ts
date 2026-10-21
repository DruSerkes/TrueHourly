/**
 * Parsing what people actually type into a money field.
 *
 * Nobody types `180000`. They type `180,000`, or `$180,000`, or `180k`, and a
 * field that rejects any of those is a field that makes the user do the
 * computer's job. So this accepts all three, plus the whitespace and the stray
 * leading `$` that come with pasting from an offer letter.
 *
 * ── The contract ────────────────────────────────────────────────────────
 *
 * `null` means "I could not read this", NOT "zero". The distinction is the
 * whole reason this returns a nullable: a user halfway through typing `1.` or
 * who pasted `abc` has not said their salary is nothing, and a parser that
 * reported 0 would silently wipe the number they had. The caller keeps the last
 * good value and leaves the text alone.
 *
 * An EMPTY field is different and does mean zero. Clearing a field is a
 * deliberate act with an obvious meaning, and the alternative — a field that
 * cannot be emptied — is worse.
 *
 * Nothing here rounds or clamps. Rounding belongs at the render boundary
 * (`format.ts`) and laundering belongs to the engine (`numbers.ts`); a parser
 * that quietly adjusted the number would put a third opinion in between.
 */

/** `k`/`m` shorthand. Case-insensitive; `b` is deliberately absent. */
const MULTIPLIERS: Record<string, number> = { k: 1_000, m: 1_000_000 };

/**
 * A number, with an optional single-letter magnitude suffix. Anchored at both
 * ends so `12k3` and `1.2.3` fail rather than parsing as their prefix — a
 * `parseFloat` here would read `1.2.3` as `1.2` and look like it worked.
 */
const NUMERIC = /^(-?(?:\d+(?:\.\d+)?|\.\d+))([km])?$/;

/**
 * Parse a money-ish string. Returns `null` when the text is not a number.
 *
 * Accepts: `180000`, `180,000`, `$180,000`, `180k`, `$1.8m`, `  180000  `.
 * Rejects: `abc`, `12k3`, `1.2.3`, `--5`, `k`, `$`, `180 000`.
 */
export function parseNumeric(text: string): number | null {
  const trimmed = text.trim();
  // Only a genuinely blank field means zero. See the header.
  if (trimmed === '') return 0;

  // Group separators and currency symbols carry no information once the field
  // is known to be money, so they are removed rather than validated.
  //
  // Internal whitespace is deliberately NOT removed, which costs the
  // European-style `180 000` and is worth it: strip spaces and `1 2` parses as
  // twelve, and a typo that silently becomes a plausible number is worse than
  // one that is rejected. The brief asked for `180,000`, `180k` and `$180,000`;
  // space-separated groups were never on the list.
  const cleaned = trimmed.replace(/[,$_]/g, '').toLowerCase();
  // Non-blank text that reduced to nothing — a lone `$` — said no number at
  // all, which is not the same as an empty field.
  if (cleaned === '') return null;

  const match = NUMERIC.exec(cleaned);
  if (match === null) return null;

  const [, digits, suffix] = match;
  if (digits === undefined) return null;

  const value = Number(digits);
  if (!Number.isFinite(value)) return null;

  const multiplier = suffix === undefined ? 1 : (MULTIPLIERS[suffix] ?? 1);
  return value * multiplier;
}

/**
 * Parse a percentage-shaped field into the decimal the engine wants.
 *
 * `32`, `32%` and `32 %` all come back as `0.32`. The conversion lives here, at
 * the one boundary where a percentage exists at all — CLAUDE.md's `Pct` suffix
 * convention is about making exactly this point visible, and past it everything
 * is a decimal.
 */
export function parsePercent(text: string): number | null {
  const value = parseNumeric(text.replace(/%/g, ''));
  return value === null ? null : value / 100;
}
