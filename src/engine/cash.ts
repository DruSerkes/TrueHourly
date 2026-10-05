/**
 * Cash compensation line items (DESIGN.md §2.3, category `cash`).
 *
 * All three are `taxable` — face value, no gross-up. Base and bonus are the
 * numbers the user already thinks of as their pay; the sign-on is the only one
 * that needs a model, because a one-time payment is not an annual rate until
 * you say over how long you are spreading it.
 *
 * Every function here returns a `LineItemDraft`. The gross-up lives in
 * `tax.ts`, which is the only place a `salaryEquivalent` is ever written.
 */

import { dollars, nonNegative } from './numbers.ts';
import type { CashInput, LineItemDraft } from './types.ts';

/**
 * Tenure floor for amortizing the sign-on bonus. A tenure of 0 would divide by
 * zero; a year is the shortest window over which "per year" means anything, and
 * it attributes the whole bonus to year one, which is what actually happened.
 */
const MIN_TENURE_YEARS = 1;

/**
 * Base salary. Always present, even at $0 — it is the anchor the user arrived
 * with (`baseHourlyNaive`) and a stable first row makes the breakdown readable.
 */
export function baseSalaryItem(cash: CashInput): LineItemDraft {
  return {
    id: 'base-salary',
    label: 'Base salary',
    category: 'cash',
    bucket: 'taxable',
    annualValue: dollars(nonNegative(cash.baseSalary)),
    confidence: 'entered',
  };
}

/**
 * Target annual bonus, as a share of base (DESIGN.md §2.3: "Annual bonus
 * (target %)"). `bonusTargetPct` is a decimal, so 0.10 of a $180,000 base is
 * $18,000.
 *
 * This is a *target*, not a paid amount — a real risk of overstatement, which
 * is why it carries a note rather than being silently folded into base.
 */
export function bonusItem(cash: CashInput): LineItemDraft {
  const base = nonNegative(cash.baseSalary);
  const pct = nonNegative(cash.bonusTargetPct);

  return {
    id: 'annual-bonus',
    label: 'Annual bonus (target)',
    category: 'cash',
    bucket: 'taxable',
    annualValue: dollars(base * pct),
    confidence: 'entered',
    note: 'Target, not guaranteed. Payout usually depends on company and individual performance.',
  };
}

/**
 * Sign-on bonus, amortized over the tenure the user expects to stay.
 *
 * Spreading it is the honest treatment: a $40,000 sign-on is not $40,000 a
 * year, and counting it at face value would inflate the hourly rate of every
 * year after the first. The divisor is the user's own expected tenure, which is
 * why the resulting number is labelled as amortized in the note — the same
 * bonus is worth twice as much per hour to someone who plans to leave in two
 * years as to someone who plans to stay four.
 */
export function signOnItem(cash: CashInput): LineItemDraft {
  const bonus = nonNegative(cash.signOnBonus);
  const years = Math.max(nonNegative(cash.expectedTenureYears), MIN_TENURE_YEARS);

  return {
    id: 'sign-on-bonus',
    label: 'Sign-on bonus (amortized)',
    category: 'cash',
    bucket: 'taxable',
    annualValue: dollars(bonus / years),
    confidence: 'entered',
    note: `One-time payment spread over ${years} year${years === 1 ? '' : 's'} of expected tenure.`,
  };
}

/**
 * Every cash line item that contributes something.
 *
 * Base salary is always included; bonus and sign-on are omitted when they come
 * to $0, because a breakdown full of zero rows hides the rows that matter.
 * Totals are unaffected either way — this is purely about what the UI renders.
 */
export function computeCashItems(cash: CashInput): LineItemDraft[] {
  const items = [baseSalaryItem(cash)];

  const bonus = bonusItem(cash);
  if (bonus.annualValue > 0) items.push(bonus);

  const signOn = signOnItem(cash);
  if (signOn.annualValue > 0) items.push(signOn);

  return items;
}
