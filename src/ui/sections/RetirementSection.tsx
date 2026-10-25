/**
 * Retirement and savings: the match (in either of the two forms employers state
 * it), its vesting, profit sharing, the student-loan match, and the ESPP.
 *
 * The match leads, in either of the two forms employers state it — a dollar
 * figure or a percentage of base (`MatchField`). It sits here rather than
 * among the always-visible fields so that it is next to the two things that
 * qualify it: the cap, which only a percentage match can have, and the vesting
 * that decides whether the match is yours at all. A match entered in one place
 * and capped in another is a match that can be read wrong.
 *
 * Everything here lands in the `tax_deferred` bucket, which is the bucket the
 * app deliberately does NOT gross up (invariant 3). The disclosures say why,
 * because "free money" is the standard framing and it is only half true.
 */

import { MAX_ESPP_DISCOUNT } from '../../engine/constants.ts';
import { Section } from '../Section.tsx';
import { sumCategories } from '../contributions.ts';
import { CurrencyField } from '../fields/CurrencyField.tsx';
import { MatchField } from '../fields/MatchField.tsx';
import { NumberField } from '../fields/NumberField.tsx';
import { RateField } from '../fields/RateField.tsx';
import { ToggleField } from '../fields/ToggleField.tsx';
import { formatDollars } from '../format.ts';
import type { InputSectionProps } from './props.ts';

/** The ESPP shape a newly-ticked box starts from. */
const NEW_ESPP = { annualContribution: 0, discountRate: 0.15, hasLookback: false } as const;

export function RetirementSection({ input, result, dispatch, mode }: InputSectionProps) {
  const { retirement, cash } = input;
  const match = retirement.employerMatch;
  const espp = retirement.espp;
  const contribution = sumCategories(result.lineItems, mode, ['retirement']);

  return (
    <Section
      id="section-retirement"
      title="Retirement & savings"
      blurb="Employer 401(k) match and its cap, vesting, profit sharing, ESPP."
      summary={contribution > 0 ? formatDollars(contribution) : null}
      summaryNote="counted at face value"
    >
      <MatchField
        id="employer-match"
        label="Employer 401(k) match"
        help="Dollars per year your employer puts in, or the percentage of salary your plan
              states. Not your own contribution."
        why="Counted at face value, not as tax-free: you cannot touch it until 59½, and it is taxed when you withdraw it."
        match={match}
        baseSalary={cash.baseSalary}
        onChange={(employerMatch) => dispatch({ type: 'setEmployerMatch', employerMatch })}
      />

      {match.type === 'percent_of_base' && (
        <>
          <ToggleField
            id="match-capped"
            label="The match is capped at a dollar figure"
            checked={match.capDollars !== null}
            help="Many plans cap a percentage match at a flat annual amount."
            onChange={(capped) =>
              dispatch({
                type: 'setEmployerMatch',
                employerMatch: {
                  type: 'percent_of_base',
                  percentOfBase: match.percentOfBase,
                  // `null` is "uncapped", which is not the same as a cap of 0 —
                  // hence a toggle rather than a field where 0 means no cap.
                  capDollars: capped ? 0 : null,
                },
              })
            }
          />

          {match.capDollars !== null && (
            <CurrencyField
              id="match-cap"
              label="Match cap"
              value={match.capDollars}
              help="The most the employer will contribute in a year."
              onChange={(capDollars) =>
                dispatch({
                  type: 'setEmployerMatch',
                  employerMatch: {
                    type: 'percent_of_base',
                    percentOfBase: match.percentOfBase,
                    capDollars,
                  },
                })
              }
            />
          )}
        </>
      )}

      <NumberField
        id="match-vesting"
        label="Years until the match is fully vested"
        unit="years"
        max={10}
        value={retirement.matchVestingYears}
        help="0 if it is yours immediately."
        why="If you leave before the match vests, you lose it. The result panel flags this."
        onChange={(matchVestingYears) =>
          dispatch({ type: 'patchRetirement', patch: { matchVestingYears } })
        }
      />

      <CurrencyField
        id="profit-sharing"
        label="Profit sharing / non-elective contribution"
        value={retirement.profitSharing}
        help="Employer money that arrives whether or not you contribute anything yourself."
        onChange={(profitSharing) =>
          dispatch({ type: 'patchRetirement', patch: { profitSharing } })
        }
      />

      <CurrencyField
        id="student-loan-match"
        label="Student-loan repayment match"
        value={retirement.studentLoanMatch}
        help="Employer retirement contributions matched against your student-loan payments."
        why="Your employer matches student loan payments as if they were 401(k) contributions. Counted like a regular match."
        onChange={(studentLoanMatch) =>
          dispatch({ type: 'patchRetirement', patch: { studentLoanMatch } })
        }
      />

      <ToggleField
        id="espp-enabled"
        label="I participate in an ESPP"
        checked={espp !== null}
        help="An employee stock purchase plan lets you buy company shares at a discount."
        onChange={(enabled) =>
          dispatch({ type: 'patchRetirement', patch: { espp: enabled ? { ...NEW_ESPP } : null } })
        }
      />

      {espp !== null && (
        <>
          <CurrencyField
            id="espp-contribution"
            label="Your annual ESPP contribution"
            value={espp.annualContribution}
            help="Deducted from your own pay — the benefit is the discount on it, not the amount."
            why="Only the discount counts. $10,000 at a 15% discount buys about $11,765 of stock, a $1,765 gain."
            onChange={(annualContribution) =>
              dispatch({
                type: 'patchRetirement',
                patch: { espp: { ...espp, annualContribution } },
              })
            }
          />

          <RateField
            id="espp-discount"
            label="Purchase discount"
            max={MAX_ESPP_DISCOUNT}
            value={espp.discountRate}
            help="15% is the statutory maximum for a qualified plan and the most common figure."
            onChange={(discountRate) =>
              dispatch({ type: 'patchRetirement', patch: { espp: { ...espp, discountRate } } })
            }
          />

          <ToggleField
            id="espp-lookback"
            label="The plan has a lookback provision"
            checked={espp.hasLookback}
            help="The discount applies to the lower of the price at the start and end of the period."
            why="A lookback makes an ESPP worth more, but valuing it needs price history. Checking this adds a note that the figure is too low."
            onChange={(hasLookback) =>
              dispatch({ type: 'patchRetirement', patch: { espp: { ...espp, hasLookback } } })
            }
          />
        </>
      )}
    </Section>
  );
}
