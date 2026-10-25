/**
 * The answer, and everything needed to argue with it.
 *
 * Reading order is the argument the product makes, so it is fixed:
 *
 *   1. the number the user arrived believing — salary ÷ 2,080 — struck through;
 *   2. the real figure, large;
 *   3. the denominator, spelled out, because "2,061 hours" is the claim most
 *      likely to be disputed and it should be checkable without clicking;
 *   4. the tax assumption, adjustable, because the salary-equivalent figure is
 *      only as good as that one rate;
 *   5. the breakdown, the warnings, then the off-headline cards.
 *
 * Nothing here sticks on desktop — see the note in `App.tsx`.
 *
 * Invariant 4 governs the toggle: the engine always computes both headline
 * figures and never decides which to show. This component makes that choice and
 * labels it, which is why the mode lives in `App` state and not in the engine's
 * input — switching views is not a change to the user's compensation.
 */

import {
  DEFAULT_TAX_RATE,
  NAIVE_ANNUAL_HOURS,
  TAX_RATE_PRESETS,
  WEEKS_PER_YEAR,
} from '../engine/constants.ts';
import type { CompensationInput, TrueHourlyResult } from '../engine/types.ts';
import type { InputAction } from '../state/reducer.ts';
import { Breakdown } from './Breakdown.tsx';
import type { ValueMode } from './valueMode.ts';
import { NoteCards } from './NoteCards.tsx';
import { WarningList } from './WarningList.tsx';
import { RateField } from './fields/RateField.tsx';
import {
  formatCount,
  formatDecimal,
  formatDollars,
  formatHourly,
  formatPercent,
} from './format.ts';
import { CARD } from './styles.ts';
import { useLiveAnnouncement } from './useLiveAnnouncement.ts';

export interface ResultPanelProps {
  input: CompensationInput;
  result: TrueHourlyResult;
  dispatch: (action: InputAction) => void;
  mode: ValueMode;
  onModeChange: (mode: ValueMode) => void;
}

const MODE_LABELS: Record<ValueMode, string> = {
  faceValue: 'Face value',
  salaryEquivalent: 'Salary-equivalent',
};

const MODE_BLURBS: Record<ValueMode, string> = {
  faceValue: 'Total compensation divided by hours actually worked. No tax modelling at all.',
  salaryEquivalent:
    'The same package, restated as the salary it would take to buy it. Tax-free benefits are ' +
    'grossed up; the 401(k) match is not, because it is taxed on the way out.',
};

export function ResultPanel({ input, result, dispatch, mode, onModeChange }: ResultPanelProps) {
  const hourly = result.trueHourly[mode];
  const total = result.totals[mode];
  // Nothing entered yet. Distinguished from a real zero because the panel has
  // to say something other than `$0.00 / hour`, which reads as a finding rather
  // than as an empty form — and because `salary ÷ 2,080` is also $0.00 here, so
  // the struck-through anchor above it would be two zeroes correcting each
  // other. A first visit gets the instruction instead of the arithmetic.
  const empty = result.totals.faceValue === 0;
  const weeksWorked =
    result.hours.hoursPerWeek > 0 ? result.hours.hoursWorked / result.hours.hoursPerWeek : 0;

  // One settled sentence rather than a running commentary — see the hook.
  const announcement = useLiveAnnouncement(
    result.totals.faceValue > 0
      ? `True hourly rate, ${MODE_LABELS[mode].toLowerCase()}: ${formatHourly(hourly)} per hour. ` +
          `${formatDollars(total)} a year over ${formatCount(result.hours.hoursWorked)} hours worked.`
      : 'No compensation entered yet.'
  );

  return (
    <section aria-labelledby="result-heading" className="space-y-4">
      <h2 className="sr-only" id="result-heading">
        Your true hourly rate
      </h2>

      {/* The announcement the eye does not need; `aria-live` on a region that
          only ever holds this one settled sentence. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <div className={CARD}>
        {empty ? (
          <>
            <p className="text-sm text-ink-muted">Your true hourly rate</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight text-ink-faint tabular-nums">
                &mdash;
              </span>
              <span className="text-base text-ink-muted">/ hour</span>
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Enter your base salary to start. Everything else is optional, and the sections below
              are where the number usually moves the most &mdash; employer-paid benefits are worth a
              quarter of a package and appear on no payslip.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Your true hourly rate, {MODE_LABELS[mode].toLowerCase()}
            </p>

            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight text-accent tabular-nums">
                {formatHourly(hourly)}
              </span>
              <span className="text-base text-ink-muted">/ hour</span>
            </p>
          </>
        )}

        <fieldset className="mt-3">
          <legend className="text-xs font-medium tracking-wide text-ink-faint uppercase">
            Show
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(['faceValue', 'salaryEquivalent'] as const).map((option) => (
              <label
                key={option}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium ${
                  mode === option
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line-strong bg-surface text-ink hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="value-mode"
                  className="sr-only"
                  checked={mode === option}
                  onChange={() => onModeChange(option)}
                />
                {MODE_LABELS[option]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-muted">{MODE_BLURBS[mode]}</p>
        </fieldset>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-sm">
          <dt className="text-ink-muted">Total {mode === 'faceValue' ? 'comp' : 'equivalent'}</dt>
          <dd className="text-right font-medium text-ink tabular-nums">{formatDollars(total)}</dd>
          <dt className="text-ink-muted">Hours worked</dt>
          <dd className="text-right font-medium text-ink tabular-nums">
            {formatCount(result.hours.hoursWorked)}
          </dd>
        </dl>

        <p className="mt-2 text-xs text-ink-faint">
          {formatDecimal(result.hours.hoursPerWeek)} hours × {formatDecimal(weeksWorked)} weeks
          worked — {formatCount(WEEKS_PER_YEAR)} weeks less your time off
          {result.hours.overridden && ' (overridden directly)'}.
        </p>
      </div>

      <div className={CARD}>
        <RateField
          id="tax-rate"
          label="Your combined marginal tax rate"
          value={input.tax.combinedMarginalRate}
          presets={TAX_RATE_PRESETS}
          help={`Federal income tax + FICA + state + local, as one rate. Default ${formatPercent(
            DEFAULT_TAX_RATE
          )}. Only the salary-equivalent figure uses it.`}
          why="Tax-free benefits are worth more than the same amount of salary. At 22%, a $14,000 health premium equals about $17,900 of salary; at 42%, about $24,100."
          onChange={(combinedMarginalRate) =>
            dispatch({ type: 'patchTax', patch: { combinedMarginalRate } })
          }
        />
      </div>

      <div className={CARD}>
        <h3 className="text-sm font-semibold text-ink">Where it comes from</h3>
        <div className="mt-2">
          <Breakdown lineItems={result.lineItems} mode={mode} total={total} />
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className={CARD}>
          <WarningList warnings={result.warnings} />
        </div>
      )}

      {result.notes.length > 0 && (
        <div className={CARD}>
          <NoteCards notes={result.notes} />
        </div>
      )}
    </section>
  );
}
