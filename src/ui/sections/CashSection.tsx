/**
 * Cash beyond base salary: the bonus, and the sign-on.
 *
 * ── Why this section exists at all ──────────────────────────────────────
 *
 * DESIGN.md §6 lists six collapsible sections and this is not one of them, but
 * `CashInput` has five fields that no listed section covers, and Fixture A
 * cannot be reproduced without the bonus. The alternatives were to scatter them
 * into unrelated sections or to leave them unreachable; a seventh section is
 * the smaller deviation. Logged in DECISIONS.md.
 *
 * Both of its figures are about trusting a number rather than reading one off a
 * payslip, which is why the two treatment controls are here rather than hidden:
 * a bonus target and a bonus are the same dollars with very different odds, and
 * only the user knows which one they have.
 */

import { Section } from '../Section.tsx';
import { sumItems } from '../contributions.ts';
import { CurrencyField } from '../fields/CurrencyField.tsx';
import { NumberField } from '../fields/NumberField.tsx';
import { RateField } from '../fields/RateField.tsx';
import { SelectField } from '../fields/SelectField.tsx';
import { formatDollars } from '../format.ts';
import type { InputSectionProps } from './props.ts';

/** The rows this section can move. Base salary is an always-visible field. */
const OWN_ITEMS = ['annual-bonus', 'sign-on-bonus'];

export function CashSection({ input, result, dispatch, mode }: InputSectionProps) {
  const { cash } = input;
  const contribution = sumItems(result.lineItems, mode, OWN_ITEMS);

  return (
    <Section
      id="section-cash"
      title="Bonus & sign-on"
      blurb="Annual bonus, and a signing bonus spread over how long you expect to stay."
      summary={contribution > 0 ? formatDollars(contribution) : null}
      {...(cash.bonusTreatment === 'target' && cash.bonusTargetPct > 0
        ? { summaryNote: 'target, not guaranteed' }
        : {})}
    >
      <RateField
        id="bonus-target"
        label="Annual bonus"
        max={1}
        value={cash.bonusTargetPct}
        help="As a percentage of base salary. 10% of a $180,000 base is $18,000."
        why="Stated as a percentage because that is how bonus plans are written, and because it
             keeps the figure correct when you change the salary above to compare two offers."
        onChange={(bonusTargetPct) => dispatch({ type: 'patchCash', patch: { bonusTargetPct } })}
      />

      <SelectField
        id="bonus-treatment"
        label="Is that a target or money you expect?"
        value={cash.bonusTreatment}
        options={[
          { value: 'target', label: 'A target — it depends on performance' },
          { value: 'earned', label: 'Money I expect to be paid' },
        ]}
        help="Changes how the bonus is labelled, never how much it is worth."
        why="A target bonus is real money if it is hit, and nothing if it is not — so it is
             marked as an estimate, which makes it render distinctly in the breakdown and counts
             towards the warning about how much of your package is estimated. If yours is
             contractual, already declared, or has always paid in full, say so and it is treated
             as pay you can bank on. The app cannot tell these apart by looking, so it asks
             rather than guessing."
        onChange={(bonusTreatment) => dispatch({ type: 'patchCash', patch: { bonusTreatment } })}
      />

      <CurrencyField
        id="sign-on-bonus"
        label="Sign-on bonus"
        value={cash.signOnBonus}
        help="Paid once, usually in the first month or two."
        why="A $40,000 sign-on is not $40,000 a year, so it is divided by the years you expect to
             stay. That makes the same bonus worth twice as much per hour to someone leaving in
             two years as to someone staying four — which is why the next field matters."
        onChange={(signOnBonus) => dispatch({ type: 'patchCash', patch: { signOnBonus } })}
      />

      <NumberField
        id="expected-tenure"
        label="How long you expect to stay"
        unit="years"
        min={1}
        max={50}
        value={cash.expectedTenureYears}
        help="Used to spread the sign-on bonus. One year attributes all of it to year one."
        onChange={(expectedTenureYears) =>
          dispatch({ type: 'patchCash', patch: { expectedTenureYears } })
        }
      />

      <NumberField
        id="signon-clawback"
        label="Sign-on clawback window"
        unit="months"
        max={120}
        value={cash.signOnClawbackMonths}
        help="How long you would have to repay the sign-on if you left. 0 if there is no clawback."
        why="Money you can be made to give back is not quite money you have. This does not change
             the arithmetic — you did receive it — but if the clawback window outlasts how long
             you expect to stay, the result panel says so, because that combination means you are
             counting a bonus you may have to repay."
        onChange={(signOnClawbackMonths) =>
          dispatch({ type: 'patchCash', patch: { signOnClawbackMonths } })
        }
      />
    </Section>
  );
}
