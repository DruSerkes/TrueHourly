/**
 * Perks, stipends, and paid leave (DESIGN.md §2.3, categories `perks` and
 * `leave`).
 *
 * Two things in here are easy to get wrong and are worth reading before
 * changing anything:
 *
 *   1. **Meals are priced per day WORKED, not per calendar workday.** The value
 *      of a free lunch is `valuePerDay × hours.daysWorked`, so the same perk is
 *      worth less to someone who takes more time off. A flat 250 days would
 *      quietly reintroduce the error invariant 2 exists to prevent — the
 *      denominator and this numerator must move together.
 *   2. **Stipends default to taxable.** A cash stipend is wages; only an
 *      accountable-plan reimbursement is tax-free (DESIGN.md §2.3 note 1). The
 *      user flips `stipendTaxTreatment`; the engine does not guess.
 *
 * There is no PTO line item here or anywhere else (invariant 2), and no
 * sabbatical line item either: a paid sabbatical is the same salary for fewer
 * hours, so it is a denominator input and lives in `hours.ts`. Parental leave is
 * the one paid-leave item that stays in the numerator — the denominator does not
 * remove those weeks, and it is only paid in a year leave is actually taken.
 */

import { LIMIT_COMMUTER_MONTHLY, LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE } from './constants.ts';
import { dollars, nonNegative } from './numbers.ts';
import type {
  ContributionSet,
  HoursBreakdown,
  LeaveInput,
  LineItemDraft,
  PerksInput,
  TaxBucket,
  Warning,
} from './types.ts';

/** Everything the perk and leave items need from the rest of the input. */
export interface PerksContext {
  perks: PerksInput;
  leave: LeaveInput;
  /** Supplies `daysWorked` for the meals calculation. */
  hours: HoursBreakdown;
}

/** A stipend's bucket, per the user's accountable-plan flag. */
function stipendBucket(perks: PerksInput): TaxBucket {
  return perks.stipendTaxTreatment === 'tax_free' ? 'tax_free' : 'taxable';
}

/** The note that explains why a stipend sits in the bucket it does. */
function stipendNote(perks: PerksInput): string {
  return perks.stipendTaxTreatment === 'tax_free'
    ? 'Treated as an accountable-plan reimbursement, so it is excluded from income.'
    : 'A cash stipend is normally taxable wages. If yours is reimbursed against receipts ' +
        'under an accountable plan, mark it tax-free and it will be worth more.';
}

export function computePerksItems(context: PerksContext): ContributionSet {
  const { perks, leave, hours } = context;
  const items: LineItemDraft[] = [];
  const warnings: Warning[] = [];

  // --- Meals ---------------------------------------------------------------
  if (perks.meals.enabled) {
    const meals = nonNegative(perks.meals.valuePerDay) * nonNegative(hours.daysWorked);
    if (meals > 0) {
      items.push({
        id: 'meals',
        label: 'Free meals',
        category: 'perks',
        bucket: 'tax_free',
        annualValue: dollars(meals),
        confidence: 'entered',
        note:
          `Priced at ${Math.round(hours.daysWorked)} days actually worked, not a flat 250. ` +
          'Time off reduces this the same way it reduces your hours.',
      });
    }
  }

  // --- Commuter ------------------------------------------------------------
  const commuterMonthly = nonNegative(perks.commuterBenefitMonthly);
  const commuterClamped = commuterMonthly > LIMIT_COMMUTER_MONTHLY;
  const commuterAllowed = Math.min(commuterMonthly, LIMIT_COMMUTER_MONTHLY);
  if (commuterClamped) {
    warnings.push({
      id: 'commuter-benefit-clamped',
      severity: 'caution',
      message:
        `The qualified transportation exclusion is $${LIMIT_COMMUTER_MONTHLY} a month in 2026, so your ` +
        'commuter benefit has been capped at that. Anything your employer gives you above the ' +
        'limit is taxable wages rather than a tax-free benefit.',
    });
  }
  if (commuterAllowed > 0) {
    items.push({
      id: 'commuter-benefit',
      label: 'Commuter benefit',
      category: 'perks',
      bucket: 'tax_free',
      annualValue: dollars(commuterAllowed * 12),
      confidence: 'entered',
      note: `$${Math.round(commuterAllowed)} a month, excluded from income up to the monthly limit.`,
    });
  }

  // --- Tuition -------------------------------------------------------------
  const tuitionEntered = nonNegative(perks.tuitionReimbursement);
  const tuitionClamped = tuitionEntered > LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE;
  const tuitionAllowed = Math.min(tuitionEntered, LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE);
  if (tuitionClamped) {
    warnings.push({
      id: 'tuition-reimbursement-clamped',
      severity: 'caution',
      message:
        `IRC §127 excludes up to $${LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE.toLocaleString('en-US')} of employer education ` +
        'assistance a year, so the tax-free part has been capped there. The rest is still real ' +
        'money — it is just taxable wages, so it is not counted as a tax-free benefit here.',
    });
  }
  if (tuitionAllowed > 0) {
    items.push({
      id: 'tuition-reimbursement',
      label: 'Tuition / education reimbursement',
      category: 'perks',
      bucket: 'tax_free',
      annualValue: dollars(tuitionAllowed),
      confidence: 'entered',
      note: `Tax-free up to the §127 limit of $${LIMIT_SECTION_127_EDUCATIONAL_ASSISTANCE.toLocaleString('en-US')} a year.`,
    });
  }

  // --- Stipends ------------------------------------------------------------
  const homeOffice = dollars(nonNegative(perks.homeOfficeStipend));
  if (homeOffice > 0) {
    items.push({
      id: 'home-office-stipend',
      label: 'Home office / phone / internet stipend',
      category: 'perks',
      bucket: stipendBucket(perks),
      annualValue: homeOffice,
      confidence: 'entered',
      note: stipendNote(perks),
    });
  }

  const wellness = dollars(nonNegative(perks.wellnessStipend));
  if (wellness > 0) {
    items.push({
      id: 'wellness-stipend',
      label: 'Wellness / gym stipend',
      category: 'perks',
      bucket: stipendBucket(perks),
      annualValue: wellness,
      confidence: 'entered',
      note: stipendNote(perks),
    });
  }

  // --- Professional development -------------------------------------------
  const profDev = dollars(nonNegative(perks.professionalDevelopment));
  if (profDev > 0) {
    items.push({
      id: 'professional-development',
      label: 'Professional development budget',
      category: 'perks',
      bucket: 'tax_free',
      annualValue: profDev,
      confidence: 'entered',
      note:
        'A working-condition fringe benefit when it is spent on your current role, so it is ' +
        'excluded from income. Worth face value only if you actually use it.',
    });
  }

  // --- Parental leave ------------------------------------------------------
  // Off the headline by default: the weeks are only paid in a year leave is
  // taken, so annualizing it would overstate every other year. DESIGN.md §2.6
  // treats it as an off-headline note until the user opts in.
  if (leave.includeParentalLeaveInHeadline) {
    const parental =
      nonNegative(leave.parentalLeaveWeeks) * nonNegative(leave.parentalLeaveWeeklyRate);
    if (parental > 0) {
      items.push({
        id: 'parental-leave',
        label: 'Paid parental leave',
        category: 'leave',
        bucket: 'taxable',
        annualValue: dollars(parental),
        confidence: 'entered',
        note:
          'Counted in full in a year you take leave. In any other year it is worth nothing, ' +
          'so this raises the headline for one year rather than every year.',
      });
    }
  }

  return { items, warnings };
}
