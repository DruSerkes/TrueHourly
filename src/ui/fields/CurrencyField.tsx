/**
 * A dollars-per-year text field.
 *
 * ── The draft-string problem ────────────────────────────────────────────
 *
 * State holds a `number`; the user types characters. Those two disagree during
 * typing, and the naive fix — render `format(value)` into the input on every
 * keystroke — is what produces fields that fight you: type `180,` and the
 * reformatter deletes your comma; type `1` into an empty field and the cursor
 * jumps. So while the field is being edited it renders the user's own text
 * (`draft`), and the parsed number is pushed up to the reducer on each
 * keystroke so the result stays live. On blur the draft is dropped and the
 * field renders the committed number again, formatted.
 *
 * `draft === null` means "not editing — show the value". That is also what
 * makes a reset work for free: there is no copy of the value to go stale.
 *
 * Unparseable text is LEFT VISIBLE and marked `aria-invalid` rather than being
 * swallowed. The last good number stays in state, so the result does not lurch
 * to zero because someone was midway through a paste — but the field does not
 * pretend the characters are not there either.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatFieldValue } from '../format.ts';
import { parseNumeric } from '../parseNumber.ts';
import { helpId } from '../ids.ts';
import { INPUT, INPUT_INVALID } from '../styles.ts';
import { FieldShell } from './FieldShell.tsx';

export interface CurrencyFieldProps {
  id: string;
  label: string;
  help?: string;
  why?: ReactNode;
  /** Whole dollars per year. */
  value: number;
  onChange: (value: number) => void;
}

export function CurrencyField({ id, label, help, why, value, onChange }: CurrencyFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatFieldValue(value);
  const parsed = draft === null ? value : parseNumeric(draft);
  const invalid = parsed === null;

  function handleChange(next: string): void {
    setDraft(next);
    const asNumber = parseNumeric(next);
    // Negative pay is not a thing the engine should have to launder away
    // silently, and a minus sign is more often a typo than an intent.
    if (asNumber !== null) onChange(Math.max(asNumber, 0));
  }

  return (
    <FieldShell
      id={id}
      label={label}
      {...(help === undefined ? {} : { help })}
      {...(why === undefined ? {} : { why })}
    >
      <div className="relative">
        <span aria-hidden="true" className="absolute top-2 left-3 text-ink-faint">
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className={`${INPUT} pl-7 ${invalid ? INPUT_INVALID : ''}`}
          placeholder="0"
          value={text}
          aria-describedby={help === undefined ? undefined : helpId(id)}
          aria-invalid={invalid || undefined}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setDraft(formatFieldValue(value))}
          onBlur={() => setDraft(null)}
        />
      </div>
      {invalid && (
        <p className="mt-1 text-sm font-medium text-caution" role="alert">
          Not a number I can read. Try <code>180000</code>, <code>180,000</code> or{' '}
          <code>180k</code>.
        </p>
      )}
    </FieldShell>
  );
}
