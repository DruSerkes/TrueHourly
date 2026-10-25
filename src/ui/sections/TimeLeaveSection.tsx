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
        why="Unused accrued PTO is usually paid out when you leave. Unlimited PTO has no balance to pay out."
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
          why="Paid once when you leave, so it is shown as a separate one-time amount, not in your hourly rate."
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
        why="Unpaid leave cuts your hours and your pay. Lower your base salary to match, or the result will be too high."
        onChange={(unpaidLeaveDays) => dispatch({ type: 'patchHours', patch: { unpaidLeaveDays } })}
      />

      <NumberField
        id="sabbatical-weeks"
        label="Sabbatical length"
        unit="weeks"
        max={104}
        value={hours.sabbaticalWeeks}
        help="Paid sabbatical, in weeks. 0 if there is no programme."
        why="Same salary, fewer hours. Six weeks every five years counts as 1.2 weeks off per year."
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
        why="For hours that do not fit a weekly pattern. The result will be marked as overridden."
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
        why="Not counted in your hours, so remote and office jobs compare on the same basis."
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
        why="Only matters in a year you take it. Turn it on to see that year; leave it off to see a typical year."
        onChange={(includeParentalLeaveInHeadline) =>
          dispatch({ type: 'patchLeave', patch: { includeParentalLeaveInHeadline } })
        }
      />
    </Section>
  );
}
