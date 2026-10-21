/**
 * Health and insurance — the `health` and `insurance` categories together.
 *
 * One section for two categories because the question a user is answering is
 * one question: what does the employer pay for on my behalf that I would
 * otherwise buy myself? Splitting life and disability premiums into their own
 * accordion would be a section with three fields that nobody opens.
 *
 * The premium leads, because it is the largest of them by a wide margin and
 * the one most people have never looked up. It sits here rather than among the
 * always-visible fields so that it is beside the HSA and FSA money and the
 * coverage tier that sets their limits.
 *
 * Nearly everything here is `tax_free`, which is the bucket where this app
 * disagrees most with a salary comparison: a $14,000 premium is worth about
 * $20,600 of salary at a 32% marginal rate, and none of it appears on a
 * payslip.
 */

import {
  LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE,
  LIMIT_HSA_FAMILY,
  LIMIT_HSA_SELF_ONLY,
} from '../../engine/constants.ts';
import { Section } from '../Section.tsx';
import { anyEstimated, sumCategories } from '../contributions.ts';
import { CurrencyField } from '../fields/CurrencyField.tsx';
import { SelectField } from '../fields/SelectField.tsx';
import { formatDollars } from '../format.ts';
import type { InputSectionProps } from './props.ts';

export function HealthSection({ input, result, dispatch, mode }: InputSectionProps) {
  const { health, insurance } = input;
  const contribution = sumCategories(result.lineItems, mode, ['health', 'insurance']);
  const estimated = anyEstimated(
    result.lineItems,
    (item) => item.category === 'health' || item.category === 'insurance'
  );
  const hsaLimit = health.coverageTier === 'family' ? LIMIT_HSA_FAMILY : LIMIT_HSA_SELF_ONLY;

  return (
    <Section
      id="section-health"
      title="Health & insurance"
      blurb="The premium your employer pays, HSA and FSA money, life and disability cover."
      summary={contribution > 0 ? formatDollars(contribution) : null}
      {...(estimated ? { summaryNote: 'includes an estimate' } : {})}
    >
      <CurrencyField
        id="employer-health-premium"
        label="Employer health premium"
        value={health.employerPremiumContribution}
        help="The employer's share of medical, dental and vision premiums, per year. Not the
              part deducted from your paycheck."
        why="This is usually the largest number on the page that nobody counts. It is money
             spent on you that never appears on a payslip, and because it is excluded from
             income it is worth MORE than the same amount of salary — a $14,000 premium is
             worth about $20,600 of pay at a 32% marginal rate. Ask HR for the figure; it is on
             the benefits summary."
        onChange={(employerPremiumContribution) =>
          dispatch({ type: 'patchHealth', patch: { employerPremiumContribution } })
        }
      />

      <SelectField
        id="coverage-tier"
        label="Coverage tier"
        value={health.coverageTier}
        options={[
          { value: 'self_only', label: 'Self only' },
          { value: 'family', label: 'Family' },
        ]}
        help={`Sets which HSA limit applies: ${formatDollars(
          LIMIT_HSA_SELF_ONLY
        )} self-only, ${formatDollars(LIMIT_HSA_FAMILY)} family for 2026.`}
        onChange={(coverageTier) => dispatch({ type: 'patchHealth', patch: { coverageTier } })}
      />

      <CurrencyField
        id="employer-hsa"
        label="Employer HSA contribution"
        value={health.employerHsaContribution}
        help={`Per year. Counted against the ${formatDollars(hsaLimit)} combined limit for your tier.`}
        why="The best-treated dollar in the tax code: untaxed going in, untaxed while invested, and
             untaxed coming out for medical costs. This app values it the same as a health
             premium — grossed up by your marginal rate — which if anything understates it.
             If the figure you enter would breach the statutory limit, the result panel says so
             rather than silently using a smaller number."
        onChange={(employerHsaContribution) =>
          dispatch({ type: 'patchHealth', patch: { employerHsaContribution } })
        }
      />

      <CurrencyField
        id="employer-fsa"
        label="Employer FSA seed"
        value={health.employerFsaSeed}
        help="Employer money put into a flexible spending account, per year."
        why="Employer seed money into an FSA is tax-free like a premium, with one catch the
             arithmetic cannot see: FSA balances are use-it-or-lose-it within the plan year. The
             dollars are real, but only if you spend them."
        onChange={(employerFsaSeed) =>
          dispatch({ type: 'patchHealth', patch: { employerFsaSeed } })
        }
      />

      <CurrencyField
        id="life-premium"
        label="Employer-paid life / AD&D premium"
        value={insurance.lifeAndAddPremium}
        help="The premium your employer pays, per year — not the coverage amount."
        onChange={(lifeAndAddPremium) =>
          dispatch({ type: 'patchInsurance', patch: { lifeAndAddPremium } })
        }
      />

      <CurrencyField
        id="life-coverage"
        label="Group life coverage amount"
        value={insurance.lifeCoverageAmount}
        help="The death benefit — often one or two times salary. Does not add to your total here."
        why={`Collected because coverage above ${formatDollars(
          LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE
        )} makes part of the premium taxable income to you, which is a detail most people have
             never been told. This app counts the whole premium as tax-free and notes the
             exception rather than modelling the imputed income, because the exact figure depends
             on an IRS age table that would add precision the rest of these inputs cannot match.`}
        onChange={(lifeCoverageAmount) =>
          dispatch({ type: 'patchInsurance', patch: { lifeCoverageAmount } })
        }
      />

      <CurrencyField
        id="disability-premium"
        label="Employer-paid disability premium"
        value={insurance.disabilityPremium}
        help="Short- and long-term disability premiums your employer pays, per year."
        why="Worth more than it costs, and the one benefit here that is genuinely about risk
             rather than money: individual long-term disability cover is expensive and often
             medically underwritten, so an employer-paid group policy is cheaper than anything
             you could buy and available to people who could not buy it at all."
        onChange={(disabilityPremium) =>
          dispatch({ type: 'patchInsurance', patch: { disabilityPremium } })
        }
      />
    </Section>
  );
}
