/**
 * A plain count field — hours per week, days of PTO, days of holiday.
 *
 * Same draft-string handling as `CurrencyField` and for the same reasons; the
 * differences are that there is no `$` prefix, that the committed value is
 * shown even when it is zero (0 days of holiday is a real answer a user should
 * see, where $0 of salary reads better as an empty field), and that it accepts
 * a `max` so a typo of `450` hours a week is caught at the field instead of
 * producing a confident, absurd hourly rate.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatDecimal } from '../format.ts';
import { parseNumeric } from '../parseNumber.ts';
import { helpId } from '../ids.ts';
import { INPUT, INPUT_INVALID } from '../styles.ts';
import { FieldShell } from './FieldShell.tsx';

export interface NumberFieldProps {
  id: string;
  label: string;
  help?: string;
  why?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  /** Inclusive floor. Defaults to 0 — none of these counts can be negative. */
  min?: number;
  /** Inclusive ceiling, if the quantity has a physical one. */
  max?: number;
  /** Unit shown after the input, e.g. `hours / week`. */
  unit?: string;
}

export function NumberField({
  id,
  label,
  help,
  why,
  value,
  onChange,
  min = 0,
  max,
  unit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatDecimal(value);
  const parsed = draft === null ? value : parseNumeric(draft);
  const invalid = parsed === null;

  function handleChange(next: string): void {
    setDraft(next);
    const asNumber = parseNumeric(next);
    if (asNumber === null) return;
    const floored = Math.max(asNumber, min);
    onChange(max === undefined ? floored : Math.min(floored, max));
  }

  return (
    <FieldShell
      id={id}
      label={label}
      {...(help === undefined ? {} : { help })}
      {...(why === undefined ? {} : { why })}
    >
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className={`${INPUT} max-w-28 ${invalid ? INPUT_INVALID : ''}`}
          value={text}
          aria-describedby={help === undefined ? undefined : helpId(id)}
          aria-invalid={invalid || undefined}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setDraft(formatDecimal(value))}
          onBlur={() => setDraft(null)}
        />
        {unit !== undefined && (
          <span aria-hidden="true" className="text-sm text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {invalid && (
        <p className="mt-1 text-sm font-medium text-caution" role="alert">
          Not a number I can read.
        </p>
      )}
    </FieldShell>
  );
}
