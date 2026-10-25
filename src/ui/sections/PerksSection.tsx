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
        why={`At $15 a day across ${formatCount(result.hours.daysWorked)} working days, that is ${formatDollars(
          15 * result.hours.daysWorked
        )} a year, tax-free. More time off means fewer meals.`}
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
        why="Entered monthly to match the IRS limit. Anything above the limit is taxable, and the result panel says so."
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
        why="Enter what you will actually spend, not the policy maximum. An unused budget is not compensation."
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
        why="Reimbursements are tax-free; stipends paid as wages are not. $1,200 reimbursed is worth about $1,760 of salary at a 32% rate. Defaults to taxable."
        onChange={(stipendTaxTreatment) =>
          dispatch({ type: 'patchPerks', patch: { stipendTaxTreatment } })
        }
      />
    </Section>
  );
}
