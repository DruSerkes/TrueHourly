/**
 * Perks and stipends.
 *
 * The small numbers, and the section where the per-hour framing does the most
 * work: free lunch sounds like nothing and is worth $3,435 a year to someone
 * working 229 days, which is more than most people's raise.
 *
 * Two things in here are not simple dollar entries, and both are honest about a
 * distinction the app cannot observe. The commuter benefit is stated monthly
 * because the §132(f) exclusion is a monthly limit, and the stipend treatment
 * asks whether cash stipends are wages or reimbursements — which decides
 * whether they are grossed up, and which only the user's plan document knows.
 */

import {
  LIMIT_COMMUTER_MONTHLY,
  LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE,
} from '../../engine/constants.ts';
import { Section } from '../Section.tsx';
import { anyEstimated, sumCategories } from '../contributions.ts';
import { CurrencyField } from '../fields/CurrencyField.tsx';
import { SelectField } from '../fields/SelectField.tsx';
import { ToggleField } from '../fields/ToggleField.tsx';
import { formatCount, formatDollars } from '../format.ts';
import type { InputSectionProps } from './props.ts';

export function PerksSection({ input, result, dispatch, mode }: InputSectionProps) {
  const { perks } = input;
  const contribution = sumCategories(result.lineItems, mode, ['perks']);
  const estimated = anyEstimated(result.lineItems, (item) => item.category === 'perks');

  return (
    <Section
      id="section-perks"
      title="Perks & stipends"
      blurb="Meals, commuter, tuition, and the home-office, wellness and development budgets."
      summary={contribution > 0 ? formatDollars(contribution) : null}
      {...(estimated ? { summaryNote: 'includes an estimate' } : {})}
    >
      <ToggleField
        id="meals-enabled"
        label="Free or subsidised meals"
        checked={perks.meals.enabled}
        help="Valued per day actually worked, not per calendar day."
        why={`This is the perk the per-hour view flatters most. At $15 a day across ${formatCount(
          result.hours.daysWorked
        )} days actually worked it comes to ${formatDollars(
          15 * result.hours.daysWorked
        )} a year, tax-free — and because it is tax-free it is worth noticeably more than the same
             amount of salary. It is priced against days worked rather than 260, so taking more
             time off correctly reduces it.`}
        onChange={(enabled) =>
          dispatch({ type: 'patchPerks', patch: { meals: { ...perks.meals, enabled } } })
        }
      />

      {perks.meals.enabled && (
        <CurrencyField
          id="meal-value"
          label="Value per day"
          precise
          value={perks.meals.valuePerDay}
          help="What you would otherwise spend on lunch. The default is $15."
          onChange={(valuePerDay) =>
            dispatch({ type: 'patchPerks', patch: { meals: { ...perks.meals, valuePerDay } } })
          }
        />
      )}

      <CurrencyField
        id="commuter-benefit"
        label="Commuter / transit / parking benefit"
        value={perks.commuterBenefitMonthly}
        help={`Per MONTH, not per year — the tax-free limit is ${formatDollars(
          LIMIT_COMMUTER_MONTHLY
        )} a month for 2026.`}
        why="Stated monthly because the statutory exclusion is monthly and plans are written that
             way; the engine multiplies by twelve after checking the limit. Anything above the
             limit is taxable wages rather than a tax-free benefit, and the result panel says so
             instead of quietly using the capped figure."
        onChange={(commuterBenefitMonthly) =>
          dispatch({ type: 'patchPerks', patch: { commuterBenefitMonthly } })
        }
      />

      <CurrencyField
        id="tuition-reimbursement"
        label="Tuition / education reimbursement"
        value={perks.tuitionReimbursement}
        help={`Per year. Tax-free up to ${formatDollars(
          LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE
        )} under §127.`}
        onChange={(tuitionReimbursement) =>
          dispatch({ type: 'patchPerks', patch: { tuitionReimbursement } })
        }
      />

      <CurrencyField
        id="home-office-stipend"
        label="Home office / phone / internet stipend"
        value={perks.homeOfficeStipend}
        help="Per year."
        onChange={(homeOfficeStipend) =>
          dispatch({ type: 'patchPerks', patch: { homeOfficeStipend } })
        }
      />

      <CurrencyField
        id="wellness-stipend"
        label="Wellness / gym stipend"
        value={perks.wellnessStipend}
        help="Per year."
        onChange={(wellnessStipend) => dispatch({ type: 'patchPerks', patch: { wellnessStipend } })}
      />

      <CurrencyField
        id="professional-development"
        label="Professional development budget"
        value={perks.professionalDevelopment}
        help="Conferences, courses, books. Per year — count what you actually use."
        why="Worth entering at what you realistically spend rather than what the policy allows. An
             unused budget is not compensation, and a $5,000 line nobody claims is the easiest way
             to make this whole number wrong in your own favour."
        onChange={(professionalDevelopment) =>
          dispatch({ type: 'patchPerks', patch: { professionalDevelopment } })
        }
      />

      <SelectField
        id="stipend-treatment"
        label="How are the cash stipends paid?"
        value={perks.stipendTaxTreatment}
        options={[
          { value: 'taxable', label: 'Added to my paycheck (taxable)' },
          { value: 'tax_free', label: 'Reimbursed against receipts (tax-free)' },
        ]}
        help="Applies to the home-office, wellness and development budgets above."
        why="A $1,200 stipend paid as wages is worth $1,200; the same amount reimbursed against
             receipts under an accountable plan is worth about $1,760 at a 32% marginal rate,
             because it is never taxed. Same perk, different value, and nothing in the amount
             itself reveals which one you have — so the app asks rather than assuming. It defaults
             to taxable, the less flattering of the two."
        onChange={(stipendTaxTreatment) =>
          dispatch({ type: 'patchPerks', patch: { stipendTaxTreatment } })
        }
      />
    </Section>
  );
}
