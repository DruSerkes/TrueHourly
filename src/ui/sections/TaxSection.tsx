/**
 * The tax assumption — the advanced half of it.
 *
 * ── Why the main rate is not in here ────────────────────────────────────
 *
 * DESIGN.md §6 lists "Tax assumption" as a collapsible section, and session 5's
 * brief put the marginal-rate slider in the result panel. Both are right about
 * their own half: the marginal rate is the control that drives the
 * salary-equivalent figure, so it belongs beside the figure it moves, where you
 * can watch it move. Two sliders bound to one value, in two places, is worse
 * than either — the second one is always the stale-looking copy.
 *
 * So the slider stays in the panel and this section holds what has nowhere else
 * to be: the deferred rate, which the engine has always supported and the UI has
 * never exposed.
 */

import { MAX_TAX_RATE } from '../../engine/constants.ts';
import { Section } from '../Section.tsx';
import { RateField } from '../fields/RateField.tsx';
import { formatPercent } from '../format.ts';
import type { InputSectionProps } from './props.ts';

export function TaxSection({ input, dispatch }: InputSectionProps) {
  const { tax } = input;

  return (
    <Section
      id="section-tax"
      title="Tax assumption"
      blurb="Your marginal rate lives beside the result. This is the advanced setting behind it."
      summary={formatPercent(tax.combinedMarginalRate)}
      summaryNote={
        tax.deferredRate > 0 ? `deferred at ${formatPercent(tax.deferredRate)}` : 'marginal rate'
      }
    >
      <RateField
        id="deferred-rate"
        label="Discount applied to tax-deferred money"
        max={MAX_TAX_RATE}
        value={tax.deferredRate}
        help="Default 0% — a 401(k) match is counted at face value. Raising it discounts it."
        why="A dollar of employer 401(k) match is not a dollar of salary: you cannot spend it
             until 59½, and it is taxed as ordinary income when you finally do. This app counts
             it at face value anyway, which is the conservative choice in the sense that it
             refuses to inflate it the way a tax-free benefit is inflated — but it does not
             discount it either, because how much that illiquidity is worth to you depends on
             your age and your savings, which the app has no business guessing. If you want to
             see the match marked down, that judgment goes here, and the result panel notes that
             you made it."
        onChange={(deferredRate) => dispatch({ type: 'patchTax', patch: { deferredRate } })}
      />

      <p className="py-3 text-sm text-ink-muted">
        One rate, not a bracket calculation. The job here is unit conversion — turning a tax-free
        benefit into the salary it would take to buy it — and a full bracket engine would imply a
        precision the rest of these inputs cannot support.
      </p>
    </Section>
  );
}
