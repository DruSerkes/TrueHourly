/**
 * The four always-visible inputs: base salary, hours per week, PTO, holidays.
 *
 * They are the fraction itself — the salary on top, and the three fields that
 * decide the hours underneath. Between them they produce the one comparison
 * this app exists to make, so they are the fields that do not require opening
 * anything.
 *
 * ── Why the employer money moved below ──────────────────────────────────
 *
 * DESIGN.md §6 originally kept the 401(k) match and the employer health
 * premium up here too. They now live with the rest of their own settings — the
 * match beside its cap and vesting in "Retirement & savings", the premium
 * beside the HSA and FSA money in "Health & insurance" — which means each
 * number sits next to the controls that qualify it rather than across a
 * disclosure boundary from them.
 *
 * The cost is real and worth stating: those two are usually the largest
 * employer-paid figures in a package, and a first-time visitor now sees a
 * salary-only result until they open a section. What answers it is that each
 * section header states its own contribution, so the employer money is
 * legible without opening anything, and the empty result panel points at the
 * sections explicitly.
 *
 * The remaining inputs live in those collapsible sections rather than being
 * crammed in flat here: a form of 26 fields is a form nobody finishes.
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
  const { hours, cash } = input;

  return (
    <section aria-labelledby="your-package">
      <h2 className="text-lg font-semibold text-ink" id="your-package">
        Your package
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Four fields get you a number. The employer-paid money — your 401(k) match, health premium,
        equity, perks — is in the sections below, and it is usually worth a quarter of a package.
        Nothing leaves this browser.
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
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Benefits, equity, perks and leave are in the sections below.
        </p>
        <button
          type="button"
          className={`${BUTTON} shrink-0`}
          onClick={() => dispatch({ type: 'reset' })}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}
