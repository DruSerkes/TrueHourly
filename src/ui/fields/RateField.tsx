/**
 * The tax assumption: a slider, a text box that does the same job, and three
 * preset buttons.
 *
 * ── Why the text box is not optional ────────────────────────────────────
 *
 * A slider cannot be operated precisely by someone with a tremor, on a small
 * touch screen, or by voice control, and a keyboard user has to count arrow
 * presses to reach 33%. DESIGN.md §6 and this session's brief both say it
 * outright: slider-only inputs are not acceptable. So the slider is the
 * convenient path and the text box is the exact one, both bound to the same
 * state — not a fallback, an equal.
 *
 * The slider works in PERCENT (0–60, step 1) and converts once on the way out.
 * A range input stepping in 0.01 decimals reports `aria-valuenow="0.32"` to a
 * screen reader, which reads as "nought point three two" — true, and useless.
 * Integers plus an explicit `aria-valuetext` of `32%` is what a listener can
 * actually use. CLAUDE.md's `Pct` suffix marks the one place the conversion
 * happens.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { MAX_TAX_RATE } from '../../engine/constants.ts';
import { formatPercent } from '../format.ts';
import { helpId } from '../ids.ts';
import { parsePercent } from '../parseNumber.ts';
import { BUTTON, BUTTON_ACTIVE, INPUT, INPUT_INVALID, LABEL, SR_ONLY } from '../styles.ts';

export interface RateFieldProps {
  id: string;
  label: string;
  help?: string;
  why?: ReactNode;
  /** The rate as a decimal, e.g. `0.32`. */
  value: number;
  onChange: (rate: number) => void;
  /** Preset decimals offered as one-click buttons. */
  presets?: readonly number[];
}

const MAX_PCT = Math.round(MAX_TAX_RATE * 100);

export function RateField({ id, label, help, why, value, onChange, presets = [] }: RateFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const valuePct = Math.round(value * 1000) / 10;
  const text = draft ?? String(valuePct);
  const invalid = draft !== null && parsePercent(draft) === null;
  const helpTextId = helpId(id);
  const textId = `${id}-text`;

  function commitPct(pct: number): void {
    onChange(Math.min(Math.max(pct, 0), MAX_TAX_RATE * 100) / 100);
  }

  return (
    <div className="py-3">
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>

      <div className="mt-2 flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={0}
          max={MAX_PCT}
          step={1}
          value={Math.round(valuePct)}
          className="h-6 w-full"
          aria-describedby={help === undefined ? undefined : helpTextId}
          aria-valuetext={formatPercent(value)}
          onChange={(event) => commitPct(Number(event.target.value))}
        />

        {/* The text-entry equal. Its own label, because a control sharing
            another control's label is an unlabelled control. */}
        <label className={SR_ONLY} htmlFor={textId}>
          {label}, as a percentage
        </label>
        <div className="flex shrink-0 items-center gap-1">
          <input
            id={textId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={`${INPUT} w-20 ${invalid ? INPUT_INVALID : ''}`}
            value={text}
            aria-describedby={help === undefined ? undefined : helpTextId}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              const parsed = parsePercent(event.target.value);
              if (parsed !== null) commitPct(parsed * 100);
            }}
            onFocus={() => setDraft(String(valuePct))}
            onBlur={() => setDraft(null)}
          />
          <span aria-hidden="true" className="text-ink-muted">
            %
          </span>
        </div>
      </div>

      {presets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted" id={`${id}-presets`}>
            Presets:
          </span>
          {presets.map((preset) => {
            const active = Math.abs(preset - value) < 0.0005;
            return (
              <button
                key={preset}
                type="button"
                className={active ? BUTTON_ACTIVE : BUTTON}
                aria-pressed={active}
                onClick={() => onChange(preset)}
              >
                {formatPercent(preset)}
              </button>
            );
          })}
        </div>
      )}

      {help !== undefined && (
        <p className="mt-2 text-sm text-ink-muted" id={helpTextId}>
          {help}
        </p>
      )}
      {why !== undefined && (
        <details className="mt-1.5 text-sm">
          <summary className="cursor-pointer text-accent-strong underline decoration-dotted">
            Why this matters
          </summary>
          <div className="mt-1.5 text-ink-muted">{why}</div>
        </details>
      )}
    </div>
  );
}
