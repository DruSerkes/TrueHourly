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

      <div className={`${CARD} mt-3 divide-y divide-line`}>
        <CurrencyField
          id="base-salary"
          label="Base salary"
          help="Gross annual salary, before tax and before any deductions."
          value={cash.baseSalary}
          onChange={(baseSalary) => dispatch({ type: 'patchCash', patch: { baseSalary } })}
        />

        <NumberField
          id="hours-per-week"
          label="Hours per week"
          unit="hours / week"
          help="What you actually work in a normal week, not what your contract says."
          max={168}
          why="Two jobs with the same salary are not equal if one takes more time."
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
          why="PTO is not extra money. It is fewer hours for the same salary, which raises your hourly rate."
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
          why="Paid days off, like PTO reduce your denominator."
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
