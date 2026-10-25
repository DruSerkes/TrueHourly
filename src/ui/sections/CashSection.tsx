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
        why="Entered as a percentage so it stays correct when you change the salary."
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
        why="A target bonus only counts if it pays out, so it is marked as an estimate. If yours is guaranteed, say so."
        onChange={(bonusTreatment) => dispatch({ type: 'patchCash', patch: { bonusTreatment } })}
      />

      <CurrencyField
        id="sign-on-bonus"
        label="Sign-on bonus"
        value={cash.signOnBonus}
        help="Paid once, usually in the first month or two."
        why="Spread over the years you expect to stay: $40,000 is $20,000 a year over two years, or $10,000 over four."
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
        why="If the clawback period is longer than you plan to stay, you may have to pay it back."
        onChange={(signOnClawbackMonths) =>
          dispatch({ type: 'patchCash', patch: { signOnClawbackMonths } })
        }
      />
    </Section>
  );
}
