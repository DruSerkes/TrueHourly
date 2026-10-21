/**
 * The six always-visible inputs (DESIGN.md §6): base salary, hours per week,
 * PTO, holidays, the 401(k) match, and the employer health premium.
 *
 * Six is not an arbitrary cut. They are the fields that between them move the
 * answer most: two set the denominator, two set the time off that shrinks it,
 * and two are the employer money a naive hourly rate ignores entirely. A user
 * who fills in only these gets a number worth looking at, which is the test for
 * whether a field belongs above the fold.
 *
 * The remaining ~20 inputs get collapsible sections in session 6. They are
 * deliberately absent here rather than crammed in flat: a form of 26 fields is
 * a form nobody finishes.
 *
 * Every field carries a "why this matters" disclosure. DESIGN.md §6 is blunt
 * about this — for a first-time visitor the explanations ARE the product. The
 * app's whole claim is that the usual number is wrong, and a claim with no
 * reasoning attached is just a different number to distrust.
 */

import { ptoDaysOf, withPtoDays } from '../state/reducer.ts';
import type { InputAction } from '../state/reducer.ts';
import type { CompensationInput } from '../engine/types.ts';
import { CurrencyField } from './fields/CurrencyField.tsx';
import { NumberField } from './fields/NumberField.tsx';
import { BUTTON, CARD } from './styles.ts';

export interface CoreInputsProps {
  input: CompensationInput;
  dispatch: (action: InputAction) => void;
}

export function CoreInputs({ input, dispatch }: CoreInputsProps) {
  const { hours, cash, retirement, health } = input;
  const match = retirement.employerMatch;

  return (
    <section aria-labelledby="your-package">
      <h2 className="text-lg font-semibold text-ink" id="your-package">
        Your package
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Six fields get you a real number. Everything is optional and nothing leaves this browser.
      </p>

      <div className={`${CARD} mt-3 divide-y divide-line`}>
        <CurrencyField
          id="base-salary"
          label="Base salary"
          help="Gross annual salary, before tax and before any deductions."
          why="This is the only number most people compare offers on, and on its own it is the
               least informative one here. It sets the anchor the rest of the page corrects:
               salary divided by 2,080 hours."
          value={cash.baseSalary}
          onChange={(baseSalary) => dispatch({ type: 'patchCash', patch: { baseSalary } })}
        />

        <NumberField
          id="hours-per-week"
          label="Hours per week"
          unit="hours / week"
          help="What you actually work in a normal week, not what your contract says."
          max={168}
          why="This is the denominator, and it is where most of the honesty in this app lives.
               Two offers with identical pay are not equal if one of them takes fifteen more
               hours a week — but a salary comparison cannot see that, because the salary is
               the same either way."
          value={hours.hoursPerWeek}
          onChange={(hoursPerWeek) => dispatch({ type: 'patchHours', patch: { hoursPerWeek } })}
        />

        <NumberField
          id="pto-days"
          label="Paid time off"
          unit="days / year"
          help="Days of PTO or vacation per year. Under an unlimited policy, the days you
                realistically take."
          max={365}
          why="Paid time off is not extra money — your salary is the same whether you take five
               days or twenty-five. What it actually buys you is fewer hours worked for that
               same salary, so it raises your hourly rate from the bottom of the fraction. Adding
               a dollar value for PTO on top of that would be counting it twice."
          value={ptoDaysOf(hours.ptoPlan)}
          onChange={(days) =>
            dispatch({ type: 'setPtoPlan', ptoPlan: withPtoDays(hours.ptoPlan, days) })
          }
        />

        <NumberField
          id="holiday-days"
          label="Company holidays"
          unit="days / year"
          help="Paid public and company holidays per year."
          max={365}
          why="Same mechanism as PTO: paid days you do not work. Worth listing separately
               because holidays are easy to forget and there are usually ten or eleven of
               them — two weeks of your year."
          value={hours.holidayDays}
          onChange={(holidayDays) => dispatch({ type: 'patchHours', patch: { holidayDays } })}
        />

        <CurrencyField
          id="employer-match"
          label="Employer 401(k) match"
          help="Dollars per year your employer puts in. Not your own contribution."
          why="Free money, but not the same kind of money as salary: you cannot spend it until
               59½ and it is taxed as ordinary income when you do. So this app counts it at
               face value and deliberately does not treat it as tax-free — inflating it would
               be the sort of error that discredits the whole number."
          value={match.type === 'amount' ? match.annualAmount : 0}
          onChange={(annualAmount) =>
            dispatch({ type: 'setEmployerMatch', employerMatch: { type: 'amount', annualAmount } })
          }
        />

        <CurrencyField
          id="employer-health-premium"
          label="Employer health premium"
          help="The employer's share of medical, dental and vision premiums, per year. Not the
                part deducted from your paycheck."
          why="This is usually the largest number on the page that nobody counts. It is money
               spent on you that never appears on a payslip, and because it is excluded from
               income it is worth MORE than the same amount of salary — a $14,000 premium is
               worth about $20,600 of pay at a 32% marginal rate. Ask HR for the figure; it is
               on the benefits summary."
          value={health.employerPremiumContribution}
          onChange={(employerPremiumContribution) =>
            dispatch({ type: 'patchHealth', patch: { employerPremiumContribution } })
          }
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Equity, perks, stipends and leave are coming in the next release.
        </p>
        <button type="button" className={BUTTON} onClick={() => dispatch({ type: 'reset' })}>
          Reset to defaults
        </button>
      </div>
    </section>
  );
}
