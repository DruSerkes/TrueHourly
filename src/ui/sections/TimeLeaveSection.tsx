/**
 * Time and leave — the rest of the denominator, plus paid parental leave.
 *
 * This is the section where invariant 2 is visible. Almost nothing in here adds
 * a dollar to anything: a sabbatical, unpaid leave and the working-days pattern
 * all change the hours the salary is divided by, which is why the header
 * summarises this section in HOURS rather than in dollars. The one genuine
 * numerator item is parental leave, and it is off by default because it is only
 * paid in a year you take it.
 *
 * Commute is collected and deliberately excluded from the headline: it is time
 * the job costs you that you are not paid for, which is a different and equally
 * real number, and folding it into this one would make the result
 * incomparable to anybody else's.
 */

import { ptoDaysOf } from '../../state/reducer.ts';
import { Section } from '../Section.tsx';
import { sumCategories } from '../contributions.ts';
import { CurrencyField } from '../fields/CurrencyField.tsx';
import { NumberField } from '../fields/NumberField.tsx';
import { SelectField } from '../fields/SelectField.tsx';
import { ToggleField } from '../fields/ToggleField.tsx';
import { formatCount, formatDollars } from '../format.ts';
import type { InputSectionProps } from './props.ts';

export function TimeLeaveSection({ input, result, dispatch, mode }: InputSectionProps) {
  const { hours, leave } = input;
  const plan = hours.ptoPlan;
  const leaveContribution = sumCategories(result.lineItems, mode, ['leave']);

  return (
    <Section
      id="section-time"
      title="Time & leave"
      blurb="PTO plan type, working pattern, sabbatical, unpaid leave, parental leave, commute."
      summary={`${formatCount(result.hours.hoursWorked)} hrs`}
      summaryNote={
        leaveContribution > 0
          ? `+ ${formatDollars(leaveContribution)} leave`
          : 'hours worked a year'
      }
    >
      <SelectField
        id="pto-plan-type"
        label="PTO plan type"
        value={plan.type}
        options={[
          { value: 'accrual', label: 'Accrual — I earn days and they bank' },
          { value: 'unlimited', label: 'Unlimited / flexible' },
        ]}
        help="The hours arithmetic is identical either way. What changes is what happens when you leave."
        why="Under an accrual plan an unused balance is money: most states require it to be paid
             out when you leave, so it appears as a one-off note beside the result. Unlimited PTO
             has no balance to pay out, which makes it worth strictly less than the accrual plan it
             replaced — and the usual finding is that people take fewer days under it, not more."
        onChange={(type) =>
          dispatch({
            type: 'setPtoPlan',
            // The days field means a different thing in each mode, so the union
            // is rebuilt rather than patched — but the number the user typed is
            // carried across, because switching plan type is not a statement
            // about how much time off they take.
            ptoPlan:
              type === 'accrual'
                ? { type: 'accrual', ptoDays: ptoDaysOf(plan), expectedAccruedBalanceDays: 0 }
                : { type: 'unlimited', expectedDaysTaken: ptoDaysOf(plan) },
          })
        }
      />

      {plan.type === 'accrual' && (
        <NumberField
          id="accrued-balance"
          label="PTO days you expect to have banked when you leave"
          unit="days"
          max={365}
          value={plan.expectedAccruedBalanceDays}
          help="Used for the payout note only. It never enters the hourly rate."
          why="An accrued balance is a genuine asset, but it is paid once, on separation — so
               dividing it by the hours you work in a year would answer a question nobody asked.
               It sits beside the result as a one-off figure instead."
          onChange={(expectedAccruedBalanceDays) =>
            dispatch({
              type: 'setPtoPlan',
              ptoPlan: { ...plan, expectedAccruedBalanceDays },
            })
          }
        />
      )}

      <NumberField
        id="days-per-week"
        label="Working days per week"
        unit="days / week"
        min={1}
        max={7}
        value={hours.daysPerWeek}
        help="Divides your days off into weeks, and prices anything valued per day worked."
        onChange={(daysPerWeek) => dispatch({ type: 'patchHours', patch: { daysPerWeek } })}
      />

      <NumberField
        id="unpaid-leave"
        label="Unpaid leave you expect to take"
        unit="days / year"
        max={365}
        value={hours.unpaidLeaveDays}
        help="Days off that you are not paid for."
        why="Unpaid days cut both ways and the app only models one of them: they reduce the hours
             you work, which raises the rate, but they also reduce the salary, which this field
             does not touch. If you take a lot of unpaid leave, reduce the base salary to match —
             otherwise the result is flattering."
        onChange={(unpaidLeaveDays) => dispatch({ type: 'patchHours', patch: { unpaidLeaveDays } })}
      />

      <NumberField
        id="sabbatical-weeks"
        label="Sabbatical length"
        unit="weeks"
        max={104}
        value={hours.sabbaticalWeeks}
        help="Paid sabbatical, in weeks. 0 if there is no programme."
        why="A paid sabbatical is the same salary for fewer hours, so it belongs in the
             denominator rather than being counted as extra compensation. Six weeks every five
             years is 1.2 weeks off in every year you stay — which is how it is counted here."
        onChange={(sabbaticalWeeks) => dispatch({ type: 'patchHours', patch: { sabbaticalWeeks } })}
      />

      <NumberField
        id="sabbatical-cycle"
        label="Years between sabbaticals"
        unit="years"
        max={40}
        value={hours.sabbaticalCycleYears}
        help="How often it comes around. 0 means no sabbatical, whatever the length above says."
        onChange={(sabbaticalCycleYears) =>
          dispatch({ type: 'patchHours', patch: { sabbaticalCycleYears } })
        }
      />

      <ToggleField
        id="hours-override-enabled"
        label="Enter my annual hours directly instead"
        checked={hours.hoursWorkedOverride !== null}
        help="Skips the arithmetic above and uses one figure you provide."
        why="For anyone whose year does not decompose into weeks — contractors, shift work,
             anybody tracking their own hours. The result panel marks the figure as overridden,
             because a number nobody can check from the inputs shown should say so."
        onChange={(enabled) =>
          dispatch({
            type: 'patchHours',
            // `null` means derive; a number means override. Seeded with the
            // derived figure so turning it on does not move the result.
            patch: { hoursWorkedOverride: enabled ? Math.round(result.hours.hoursWorked) : null },
          })
        }
      />

      {hours.hoursWorkedOverride !== null && (
        <NumberField
          id="hours-override"
          label="Annual hours worked"
          unit="hours / year"
          max={8760}
          value={hours.hoursWorkedOverride}
          help="Everything is divided by this figure."
          onChange={(hoursWorkedOverride) =>
            dispatch({ type: 'patchHours', patch: { hoursWorkedOverride } })
          }
        />
      )}

      <NumberField
        id="commute-minutes"
        label="One-way commute"
        unit="minutes"
        max={600}
        value={hours.commuteMinutesOneWay}
        help="Collected but deliberately left out of the hourly rate."
        why="Commuting is time the job takes and does not pay for, and there is a good argument
             for putting it in the denominator. It is left out so that the headline stays
             comparable between a remote job and an office one on the same basis everyone else
             uses — and because a rate that silently included it would be impossible to check
             against a payslip."
        onChange={(commuteMinutesOneWay) =>
          dispatch({ type: 'patchHours', patch: { commuteMinutesOneWay } })
        }
      />

      <NumberField
        id="parental-leave-weeks"
        label="Paid parental leave offered"
        unit="weeks"
        max={104}
        value={leave.parentalLeaveWeeks}
        help="Weeks of paid leave the policy offers."
        onChange={(parentalLeaveWeeks) =>
          dispatch({ type: 'patchLeave', patch: { parentalLeaveWeeks } })
        }
      />

      <CurrencyField
        id="parental-leave-rate"
        label="Pay rate during parental leave"
        value={leave.parentalLeaveWeeklyRate}
        help="Per week. Full pay on a $180,000 salary is about $3,460."
        onChange={(parentalLeaveWeeklyRate) =>
          dispatch({ type: 'patchLeave', patch: { parentalLeaveWeeklyRate } })
        }
      />

      <ToggleField
        id="parental-leave-headline"
        label="Count parental leave in the headline number"
        checked={leave.includeParentalLeaveInHeadline}
        help="Off by default. It appears as a note beside the result either way."
        why="Unlike every other benefit here, this one is only worth anything in a year you
             actually take it — and then it is worth a great deal. Averaging it across your whole
             tenure would understate it in the year it matters and overstate it in every other, so
             the app refuses to pick for you: leave it off to see your ordinary year, turn it on
             to see the year you take leave."
        onChange={(includeParentalLeaveInHeadline) =>
          dispatch({ type: 'patchLeave', patch: { includeParentalLeaveInHeadline } })
        }
      />
    </Section>
  );
}
