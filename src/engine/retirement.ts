/**
 * Retirement and savings line items (DESIGN.md §2.3, category `retirement`).
 *
 * Three of the four are `tax_deferred`, which the engine does NOT gross up like
 * `tax_free` (invariant 3): an employer 401(k) contribution escapes payroll tax
 * permanently, but it is taxed as ordinary income on withdrawal and is illiquid
 * until 59.5, so counting it as tax-free money would overstate it. The ESPP
 * discount is the exception — it is a gain realized in a brokerage account, and
 * `taxable` is the honest bucket.
 *
 * The one statutory check here is IRC §415(c): total annual additions to a
 * defined contribution plan. See `clampToAnnualAdditionsLimit` for what the
 * engine can and cannot know about the user's headroom.
 */

import { LIMIT_DEFINED_CONTRIBUTION_TOTAL, MAX_ESPP_DISCOUNT } from './constants.ts';
import { clamp, dollars, nonNegative } from './numbers.ts';
import { annualAdditionsLimitClamped, matchVestingCliff } from './warnings.ts';
import type {
  ContributionSet,
  EmployerMatch,
  EsppInput,
  LineItemDraft,
  RetirementInput,
  Warning,
} from './types.ts';

/**
 * The employer match in dollars per year, whichever way the plan states it.
 *
 * A `capDollars` of `null` means uncapped, which is deliberately distinct from
 * a cap of 0 — the same distinction `hoursWorkedOverride` makes. Reading a
 * missing cap as 0 would silently zero out a real match.
 */
export function employerMatchAmount(match: EmployerMatch, baseSalary: number): number {
  if (match.type === 'amount') return nonNegative(match.annualAmount);

  const uncapped = nonNegative(baseSalary) * nonNegative(match.percentOfBase);
  return match.capDollars === null ? uncapped : Math.min(uncapped, nonNegative(match.capDollars));
}

/**
 * Scale employer contributions down to the §415(c) annual additions limit.
 *
 * Two honest limitations, both reflected in the warning text:
 *
 *   1. §415(c) counts the EMPLOYEE's elective deferrals too, and the engine
 *      never asks for them (they are the user's own money, not compensation —
 *      see DESIGN.md §2.3, which lists no employee-deferral line item). So the
 *      real headroom is smaller than this check assumes, and a package that
 *      passes here can still breach the limit in practice.
 *   2. When the limit does bind, the excess is spread across the contributions
 *      PROPORTIONALLY. Any priority order — match first, profit sharing second
 *      — would be an invented plan rule; proportional scaling is the only
 *      treatment that does not depend on the order the fields happen to be in.
 */
function clampToAnnualAdditionsLimit(values: readonly number[]): {
  scaled: number[];
  clamped: boolean;
} {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= LIMIT_DEFINED_CONTRIBUTION_TOTAL || total <= 0) {
    return { scaled: [...values], clamped: false };
  }

  const factor = LIMIT_DEFINED_CONTRIBUTION_TOTAL / total;
  return { scaled: values.map((value) => value * factor), clamped: true };
}

/**
 * The ESPP discount value (DESIGN.md §2.3).
 *
 *     annualContribution × discountRate / (1 - discountRate)
 *
 * Why that shape rather than `contribution × discountRate`: a 15% discount buys
 * $1,000 of stock for $850, so $850 of payroll money yields a $150 gain —
 * 17.6% of what was contributed, not 15%. The divisor converts "discount off
 * the market price" into "gain on the money you put in", which is the figure
 * that belongs next to a salary.
 */
export function esppDiscountValue(espp: EsppInput): number {
  const contribution = nonNegative(espp.annualContribution);
  const rate = clamp(espp.discountRate, 0, MAX_ESPP_DISCOUNT);
  return (contribution * rate) / (1 - rate);
}

/** Employer 401(k) match. `tax_deferred` — face value, never grossed up. */
function matchItem(annualValue: number, match: EmployerMatch): LineItemDraft {
  const note =
    match.type === 'percent_of_base'
      ? `${(nonNegative(match.percentOfBase) * 100).toFixed(2).replace(/\.?0+$/, '')}% of base` +
        (match.capDollars === null ? '.' : `, capped at $${dollars(match.capDollars)}.`)
      : undefined;

  return {
    id: 'employer-401k-match',
    label: 'Employer 401(k) match',
    category: 'retirement',
    bucket: 'tax_deferred',
    annualValue: dollars(annualValue),
    confidence: 'entered',
    ...(note === undefined ? {} : { note }),
  };
}

export function computeRetirementItems(
  retirement: RetirementInput,
  baseSalary: number
): ContributionSet {
  const items: LineItemDraft[] = [];
  const warnings: Warning[] = [];

  const employerContributions = [
    employerMatchAmount(retirement.employerMatch, baseSalary),
    nonNegative(retirement.profitSharing),
    nonNegative(retirement.studentLoanMatch),
  ] as const;

  const { scaled, clamped } = clampToAnnualAdditionsLimit(employerContributions);
  const [match = 0, profitSharing = 0, studentLoanMatch = 0] = scaled;

  if (clamped) warnings.push(annualAdditionsLimitClamped());

  if (match > 0) items.push(matchItem(match, retirement.employerMatch));

  // DESIGN.md §2.5: a match plus a vesting cliff means the headline is counting
  // money the user does not own yet. The trigger lives here because this is the
  // only place that knows the match resolved to a non-zero figure — a 0% match
  // with a five-year schedule is not worth warning about.
  const vestingYears = nonNegative(retirement.matchVestingYears);
  if (match > 0 && vestingYears > 0) warnings.push(matchVestingCliff(match, vestingYears));

  if (profitSharing > 0) {
    items.push({
      id: 'profit-sharing',
      label: 'Employer non-elective / profit sharing',
      category: 'retirement',
      bucket: 'tax_deferred',
      annualValue: dollars(profitSharing),
      confidence: 'entered',
    });
  }

  if (studentLoanMatch > 0) {
    items.push({
      id: 'student-loan-match',
      label: 'Student loan repayment match',
      category: 'retirement',
      bucket: 'tax_deferred',
      annualValue: dollars(studentLoanMatch),
      confidence: 'entered',
      note:
        'SECURE 2.0 lets an employer match your student loan payments with a retirement ' +
        'contribution. It lands in your 401(k), not your bank account.',
    });
  }

  const espp = retirement.espp;
  if (espp !== null) {
    const value = esppDiscountValue(espp);
    if (value > 0) {
      items.push({
        id: 'espp-discount',
        label: 'ESPP discount value',
        category: 'retirement',
        bucket: 'taxable',
        annualValue: dollars(value),
        confidence: 'entered',
        note:
          'Values the purchase discount only. It ignores the lookback provision' +
          (espp.hasLookback ? ' your plan has' : '') +
          ', which makes an ESPP worth more than this, and it ignores holding-period tax ' +
          'treatment — selling immediately makes the discount ordinary income, while holding ' +
          'can qualify part of the gain for long-term rates.',
      });
    }
  }

  return { items, warnings };
}
