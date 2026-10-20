/**
 * Health and employer-paid insurance line items (DESIGN.md §2.3, categories
 * `health` and `insurance`).
 *
 * Every item here is `tax_free`, which makes this the module the gross-up
 * actually bites on: at t = 0.32, a $14,000 employer premium is worth $20,588
 * of salary. That is the single largest correction the app makes to a naive
 * hourly rate, and it is why the tax slider exists at all (DESIGN.md §2.2).
 *
 * Insurance lives here rather than in its own file: CLAUDE.md's layout has no
 * `insurance.ts`, and the premiums are the same kind of thing as a health
 * premium — employer money spent on cover the user never sees as wages. The
 * line items still carry `category: 'insurance'` so the breakdown groups them
 * the way DESIGN.md §2.3 does.
 */

import {
  LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE,
  LIMIT_HSA_FAMILY,
  LIMIT_HSA_SELF_ONLY,
} from './constants.ts';
import { dollars, nonNegative } from './numbers.ts';
import { hsaContributionClamped } from './warnings.ts';
import type {
  ContributionSet,
  HealthInput,
  InsuranceInput,
  LineItemDraft,
  Warning,
} from './types.ts';

/** The 2026 HSA limit for the user's coverage tier, whole dollars per year. */
export function hsaLimitFor(coverageTier: HealthInput['coverageTier']): number {
  return coverageTier === 'family' ? LIMIT_HSA_FAMILY : LIMIT_HSA_SELF_ONLY;
}

/** Clamp a contribution to a statutory limit, reporting whether it bound. */
function capped(value: number, limit: number): { value: number; clamped: boolean } {
  const amount = nonNegative(value);
  return amount > limit ? { value: limit, clamped: true } : { value: amount, clamped: false };
}

export function computeHealthItems(
  health: HealthInput,
  insurance: InsuranceInput
): ContributionSet {
  const items: LineItemDraft[] = [];
  const warnings: Warning[] = [];

  const premium = dollars(nonNegative(health.employerPremiumContribution));
  if (premium > 0) {
    items.push({
      id: 'employer-health-premium',
      label: 'Employer health / dental / vision premium',
      category: 'health',
      bucket: 'tax_free',
      annualValue: premium,
      confidence: 'entered',
      note:
        'The employer share of the premium, not the part deducted from your paycheck. ' +
        'It is excluded from income, so it is worth more than the same amount of salary.',
    });
  }

  const hsaLimit = hsaLimitFor(health.coverageTier);
  const hsa = capped(health.employerHsaContribution, hsaLimit);
  if (hsa.clamped) warnings.push(hsaContributionClamped(health.coverageTier, hsaLimit));
  if (hsa.value > 0) {
    items.push({
      id: 'employer-hsa',
      label: 'Employer HSA contribution',
      category: 'health',
      bucket: 'tax_free',
      annualValue: dollars(hsa.value),
      confidence: 'entered',
      note:
        'Tax-free going in, growing, and coming out for medical costs — the only account in ' +
        'the US code that manages all three. It is yours to keep if you leave.',
    });
  }

  // NOT clamped, deliberately. `LIMIT_HEALTH_FSA` is the employee
  // SALARY-REDUCTION limit; an employer non-elective seed is not subject to it,
  // and no sourced ceiling for an employer seed has been found. Invariant 5 says
  // a figure with no source is not a constant to apply, so the seed is taken at
  // face value. If a real employer limit turns up, add it to `constants.ts` with
  // a citation and clamp here the way the HSA contribution is clamped.
  const fsa = nonNegative(health.employerFsaSeed);
  if (fsa > 0) {
    items.push({
      id: 'employer-fsa-seed',
      label: 'Employer FSA seed',
      category: 'health',
      bucket: 'tax_free',
      annualValue: dollars(fsa),
      confidence: 'entered',
      note:
        'Use-it-or-lose-it within the plan year, unlike an HSA, so it is worth its face value ' +
        'only if you have the medical costs to spend it on.',
    });
  }

  const life = dollars(nonNegative(insurance.lifeAndAddPremium));
  if (life > 0) {
    const coverage = nonNegative(insurance.lifeCoverageAmount);
    items.push({
      id: 'life-add-premium',
      label: 'Employer-paid life / AD&D premium',
      category: 'insurance',
      bucket: 'tax_free',
      annualValue: life,
      confidence: 'entered',
      // DESIGN.md §2.3 note 2: v1 treats the whole premium as tax-free and says
      // so plainly. Splitting the premium at the coverage ceiling is a v2 job.
      note:
        `Employer-paid group term life is tax-free only up to $${LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE.toLocaleString('en-US')} ` +
        'of coverage; the premium on cover above that is imputed income on your W-2. ' +
        (coverage > LIMIT_GROUP_TERM_LIFE_TAX_FREE_COVERAGE
          ? `Your $${coverage.toLocaleString('en-US')} of coverage is above that line, so this row is ` +
            'treated as entirely tax-free and is slightly generous.'
          : 'This app treats the whole premium as tax-free.'),
    });
  }

  const disability = dollars(nonNegative(insurance.disabilityPremium));
  if (disability > 0) {
    items.push({
      id: 'disability-premium',
      label: 'Employer-paid disability premium',
      category: 'insurance',
      bucket: 'tax_free',
      annualValue: disability,
      confidence: 'entered',
      note:
        'An employer-paid premium is excluded from income, but it makes any future benefit ' +
        'taxable. The cover is worth more than the premium if you ever need it.',
    });
  }

  return { items, warnings };
}
