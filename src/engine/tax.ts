/**
 * The bucket gross-up (DESIGN.md §2.2).
 *
 *     grossUp(item) =
 *       bucket === 'tax_free'     ? annualValue / (1 - t)
 *     : bucket === 'tax_deferred' ? annualValue / (1 - tDeferred)
 *     :                             annualValue
 *
 * What this is for. Adding $180,000 of taxable salary to $14,000 of tax-free
 * health premium and calling it $194,000 is a UNIT ERROR — those dollars don't
 * buy the same amount of life. The gross-up converts every bucket into the one
 * unit the user already understands: pre-tax salary dollars. It is not a
 * paycheck estimate, which is why one rate is enough and a bracket engine would
 * be more precise about a question the app isn't asking.
 *
 * CLAUDE.md invariant 3: `tax_deferred` must NOT be grossed up like `tax_free`.
 * `tDeferred` defaults to 0 — face value — because an employer 401(k) match is
 * taxed as ordinary income on withdrawal and is illiquid until 59.5. Treating
 * it as tax-free is the kind of error that discredits the whole tool.
 */

import { MAX_TAX_RATE } from './constants.ts';
import { clamp } from './numbers.ts';
import type { LineItem, LineItemDraft, TaxBucket, TaxInput, Warning } from './types.ts';

/** Everything the gross-up needs, so it accepts a draft or a finished item. */
type Grossable = Pick<LineItem, 'bucket' | 'annualValue'>;

/**
 * A rate safe to use as `1 / (1 - rate)`.
 *
 * Clamped to `[0, MAX_TAX_RATE]`. Above 1 the divisor goes negative and a
 * benefit becomes a liability; at exactly 1 it is a division by zero. Both are
 * reachable from a restored `localStorage` save or a hand-edited URL, so the
 * clamp is not defensive about the UI — it is defensive about untrusted input.
 */
export function clampRate(rate: number): number {
  return clamp(rate, 0, MAX_TAX_RATE);
}

/**
 * The gross-up divisor for a bucket. `taxable` is 1 by construction, which is
 * why the `taxable` branch below needs no special-casing of the arithmetic.
 */
function divisorFor(bucket: TaxBucket, tax: TaxInput): number {
  switch (bucket) {
    case 'tax_free':
      return 1 - clampRate(tax.combinedMarginalRate);
    case 'tax_deferred':
      return 1 - clampRate(tax.deferredRate);
    case 'taxable':
      return 1;
  }
}

/**
 * The engine's single gross-up function: a line item's salary-equivalent value
 * in dollars per year.
 *
 * Not rounded. `LineItem.salaryEquivalent` is documented as possibly
 * fractional, and Fixture A's expected total ($257,310.29) depends on the
 * unrounded quotient.
 */
export function grossUp(item: Grossable, tax: TaxInput): number {
  const divisor = divisorFor(item.bucket, tax);
  // `clampRate` keeps the divisor in [0.4, 1], so this can't divide by zero.
  // Belt and braces anyway: a future bucket added without updating the clamp
  // should produce face value, not Infinity.
  return divisor > 0 ? item.annualValue / divisor : item.annualValue;
}

/** Finish a draft by applying the gross-up. The only way a `LineItem` is made. */
export function applyGrossUp(draft: LineItemDraft, tax: TaxInput): LineItem {
  return { ...draft, salaryEquivalent: grossUp(draft, tax) };
}

/**
 * Warnings about the tax assumption itself.
 *
 * A clamped rate must never be applied silently: the user typed a number and
 * the engine used a different one, and invariant 6 says the app never presents
 * a guess as a fact.
 */
export function taxWarnings(tax: TaxInput): Warning[] {
  const warnings: Warning[] = [];

  if (clampRate(tax.combinedMarginalRate) !== tax.combinedMarginalRate) {
    warnings.push({
      id: 'tax-rate-clamped',
      severity: 'caution',
      message:
        `Your combined marginal rate was outside the usable range and has been ` +
        `treated as ${(clampRate(tax.combinedMarginalRate) * 100).toFixed(0)}%. ` +
        `Rates at or above 100% make the salary-equivalent figure meaningless.`,
    });
  }

  if (clampRate(tax.deferredRate) !== tax.deferredRate) {
    warnings.push({
      id: 'deferred-rate-clamped',
      severity: 'caution',
      message:
        `Your tax-deferred rate was outside the usable range and has been ` +
        `treated as ${(clampRate(tax.deferredRate) * 100).toFixed(0)}%.`,
    });
  }

  if (clampRate(tax.deferredRate) > 0) {
    warnings.push({
      id: 'deferred-rate-raised',
      severity: 'info',
      message:
        `You are grossing up tax-deferred money. Employer 401(k) contributions ` +
        `escape payroll tax permanently, but they are taxed as ordinary income on ` +
        `withdrawal and are not accessible without penalty until age 59.5 — so ` +
        `they are worth less per dollar than a tax-free benefit.`,
    });
  }

  return warnings;
}
