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
        why="Often the biggest benefit nobody counts. It is tax-free, so a $14,000 premium is worth about $20,600 of salary at a 32% rate. Your benefits summary will list it."
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
        why="Untaxed going in, while invested, and coming out for medical costs. Valued the same way as a health premium."
        onChange={(employerHsaContribution) =>
          dispatch({ type: 'patchHealth', patch: { employerHsaContribution } })
        }
      />

      <CurrencyField
        id="employer-fsa"
        label="Employer FSA seed"
        value={health.employerFsaSeed}
        help="Employer money put into a flexible spending account, per year."
        why="Tax-free like a premium, but use-it-or-lose-it each plan year."
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
        why={`Coverage above ${formatDollars(
          LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE
        )} makes part of the premium taxable. The app counts all of it as tax-free and notes the exception.`}
        onChange={(lifeCoverageAmount) =>
          dispatch({ type: 'patchInsurance', patch: { lifeCoverageAmount } })
        }
      />

      <CurrencyField
        id="disability-premium"
        label="Employer-paid disability premium"
        value={insurance.disabilityPremium}
        help="Short- and long-term disability premiums your employer pays, per year."
        why="Group disability coverage costs less than buying your own, and you get it even if you could not qualify on your own."
        onChange={(disabilityPremium) =>
          dispatch({ type: 'patchInsurance', patch: { disabilityPremium } })
        }
      />
    </Section>
  );
}
