/**
 * The employer 401(k) match, enterable either way — `$7,200` or `4%`.
 *
 * ── Why the unit switch is on the field and not in a section ────────────
 *
 * Both forms were supported from the start, but the percentage form lived in
 * the collapsed "Retirement & savings" section while the always-visible field
 * took dollars only. That is the wrong way round: "4% of salary" is how plan
 * documents state a match and therefore how most people know theirs, so the
 * form that needs no arithmetic was the one hidden behind a disclosure. The
 * choice now sits on the field, and the section no longer offers a second copy
 * of it — two controls bound to one value is how a UI starts disagreeing with
 * itself.
 *
 * Switching units converts rather than clears (`asAmountMatch` /
 * `asPercentMatch`), because changing how you describe the match is not a
 * statement that it changed. The dollar figure that conversion lands on comes
 * from the engine's own `employerMatchAmount`, so what the field shows is what
 * the calculation uses.
 *
 * The same draft-string handling as `CurrencyField`, for the same reason: state
 * holds a number, the user types characters, and a field that reformats on
 * every keystroke is a field that fights you. `3.5` has to survive the moment
 * it is briefly `3.`.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { employerMatchAmount } from '../../engine/retirement.ts';
import type { EmployerMatch } from '../../engine/types.ts';
import { asAmountMatch, asPercentMatch } from '../../state/reducer.ts';
import { formatDollars, formatFieldValue } from '../format.ts';
import { helpId } from '../ids.ts';
import { parseNumeric, parsePercent } from '../parseNumber.ts';
import { BUTTON, BUTTON_ACTIVE, INPUT, INPUT_INVALID } from '../styles.ts';
import { FieldShell } from './FieldShell.tsx';

export interface MatchFieldProps {
  id: string;
  label: string;
  help?: string;
  why?: ReactNode;
  match: EmployerMatch;
  /** Needed to turn a percentage into dollars, and to show its working. */
  baseSalary: number;
  onChange: (match: EmployerMatch) => void;
}

/** Shown to one decimal: `3.5`, `4`. A match is never stated to the basis point. */
function percentText(percentOfBase: number): string {
  if (!Number.isFinite(percentOfBase) || percentOfBase === 0) return '';
  return String(Math.round(percentOfBase * 1000) / 10);
}

export function MatchField({ id, label, help, why, match, baseSalary, onChange }: MatchFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const percent = match.type === 'percent_of_base';

  const committed = percent
    ? percentText(match.percentOfBase)
    : formatFieldValue(match.annualAmount);
  const text = draft ?? committed;
  const parsed = draft === null ? 0 : percent ? parsePercent(draft) : parseNumeric(draft);
  const invalid = draft !== null && parsed === null;

  function commit(next: string): void {
    setDraft(next);
    if (percent) {
      const rate = parsePercent(next);
      if (rate !== null)
        onChange({
          type: 'percent_of_base',
          percentOfBase: Math.max(rate, 0),
          capDollars: match.capDollars,
        });
      return;
    }
    const amount = parseNumeric(next);
    if (amount !== null) onChange({ type: 'amount', annualAmount: Math.max(amount, 0) });
  }

  function switchTo(toPercent: boolean): void {
    // Drop the draft first: it holds characters in the units being left, and
    // keeping it would show a percentage in a dollar field for one render.
    setDraft(null);
    onChange(toPercent ? asPercentMatch(match, baseSalary) : asAmountMatch(match, baseSalary));
  }

  return (
    <FieldShell
      id={id}
      label={label}
      {...(help === undefined ? {} : { help })}
      {...(why === undefined ? {} : { why })}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative grow basis-40">
          <span aria-hidden="true" className="absolute top-2 left-3 text-ink-faint">
            {percent ? '%' : '$'}
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            className={`${INPUT} pl-7 ${invalid ? INPUT_INVALID : ''}`}
            placeholder={percent ? '4' : '0'}
            value={text}
            aria-describedby={help === undefined ? undefined : helpId(id)}
            aria-invalid={invalid || undefined}
            onChange={(event) => commit(event.target.value)}
            onFocus={() => setDraft(committed)}
            onBlur={() => setDraft(null)}
          />
        </div>

        {/* Buttons rather than a `<select>`: two mutually exclusive options,
            both visible, one click to change. `aria-pressed` is what tells a
            screen-reader user which set of units the field is currently in,
            since the `$`/`%` prefix beside the input is decorative. */}
        <div role="group" aria-label="Units for the employer match" className="flex shrink-0 gap-1">
          <button
            type="button"
            className={percent ? BUTTON : BUTTON_ACTIVE}
            aria-pressed={!percent}
            onClick={() => switchTo(false)}
          >
            $ / year
          </button>
          <button
            type="button"
            className={percent ? BUTTON_ACTIVE : BUTTON}
            aria-pressed={percent}
            onClick={() => switchTo(true)}
          >
            % of base
          </button>
        </div>
      </div>

      {invalid && (
        <p className="mt-1 text-sm font-medium text-caution" role="alert">
          {percent ? (
            <>
              Not a percentage I can read. Try <code>4</code> or <code>3.5</code>.
            </>
          ) : (
            <>
              Not a number I can read. Try <code>7200</code> or <code>7,200</code>.
            </>
          )}
        </p>
      )}

      {/* The arithmetic the user would otherwise be doing by hand. Live, so
          changing the salary above visibly moves it — which is the whole reason
          to enter a match as a percentage in the first place. */}
      {percent && (
        <p className="mt-1.5 text-sm text-ink-muted tabular-nums">
          {baseSalary > 0 ? (
            <>
              ={' '}
              <strong className="font-medium text-ink">
                {formatDollars(employerMatchAmount(match, baseSalary))}
              </strong>{' '}
              a year on a {formatDollars(baseSalary)} salary
              {match.capDollars !== null && <> (capped at {formatDollars(match.capDollars)})</>}
            </>
          ) : (
            'Enter a base salary above and this becomes a dollar figure.'
          )}
        </p>
      )}
    </FieldShell>
  );
}
