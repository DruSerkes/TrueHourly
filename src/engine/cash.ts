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
 * `bonusTreatment` changes the row's **confidence, never its value**. A target
 * is real money if it is hit, but whether it is hit depends on company and
 * individual performance, so `target` marks the row `estimated` — which makes
 * it render visually distinct (invariant 6) and makes it eligible for the
 * 10%-of-total estimate warning in `warnings.ts`. A user whose bonus is
 * contractual, already declared, or reliably paid in full selects `earned` and
 * the row is `entered`.
 *
 * The engine does not guess which it is. Same reasoning as
 * `PerksInput.stipendTaxTreatment`: the distinction is real, the app cannot
 * observe it, and defaulting one way silently would be the app asserting
 * something it does not know.
 */
export function bonusItem(cash: CashInput): LineItemDraft {
  const base = nonNegative(cash.baseSalary);
  const pct = nonNegative(cash.bonusTargetPct);
  const earned = cash.bonusTreatment === 'earned';

  return {
    id: 'annual-bonus',
    label: earned ? 'Annual bonus' : 'Annual bonus (target)',
    category: 'cash',
    bucket: 'taxable',
    annualValue: dollars(base * pct),
    confidence: earned ? 'entered' : 'estimated',
    note: earned
      ? 'Counted as money you expect to be paid, on your own assessment of it. If it is ' +
        'really a performance target, mark it as a target and the headline will treat it as ' +
        'an estimate.'
      : 'Target, not guaranteed. Payout usually depends on company and individual performance, ' +
        'so this is counted as an estimate rather than as pay you can bank on.',
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
 *
 * ── Why this row is `estimated`, and why it has no treatment flag ───────
 *
 * The amortized figure depends on a prediction about the future, so it is
 * `estimated` whenever the window is longer than a year — which makes it render
 * visually distinct (invariant 6) and eligible for the 10%-of-total estimate
 * warning, exactly like a bonus target.
 *
 * But the uncertainty is a DIFFERENT KIND from the bonus's, which is why
 * `bonusTreatment` has no counterpart here. A bonus target may never be paid at
 * all, and only the user knows how likely that is — so the engine asks. A
 * sign-on has already been paid in full; what is uncertain is purely the
 * arithmetic of spreading it, and that uncertainty is a fact about the divisor
 * rather than a judgment the user could resolve. Adding a flag would be asking
 * the user to confirm something the engine can already see: if
 * `expectedTenureYears` is 4, the number is a projection; if it is 1, the whole
 * bonus is attributed to year one, which is simply what happened.
 */
export function signOnItem(cash: CashInput): LineItemDraft {
  const bonus = nonNegative(cash.signOnBonus);
  const years = Math.max(nonNegative(cash.expectedTenureYears), MIN_TENURE_YEARS);
  const amortized = years > MIN_TENURE_YEARS;

  return {
    id: 'sign-on-bonus',
    label: 'Sign-on bonus (amortized)',
    category: 'cash',
    bucket: 'taxable',
    annualValue: dollars(bonus / years),
    confidence: amortized ? 'estimated' : 'entered',
    note: amortized
      ? `One-time payment spread over ${years} years of expected tenure. Counted as an ` +
        'estimate because that figure is a prediction: leave sooner and this was worth more ' +
        'per year than shown, stay longer and it was worth less.'
      : 'One-time payment counted in full against a single year, which is what actually ' +
        'happens in the year it is paid.',
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
