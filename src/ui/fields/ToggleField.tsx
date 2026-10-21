/**
 * A labelled checkbox.
 *
 * Its own component rather than a `FieldShell` with a checkbox inside, because
 * the layout is genuinely different: a checkbox's label belongs beside it on
 * the same line, where every other field's label belongs above it. Forcing it
 * through the shared shell would produce a stranded label with a lonely box
 * underneath.
 *
 * Wrapping the input in its `<label>` rather than pairing them with `htmlFor`
 * is what makes the text itself a click target, which matters most on the
 * touch screens where these boxes are hardest to hit. The `id` is still set,
 * because `aria-describedby` on the help text needs something to point from.
 */

import type { ReactNode } from 'react';
import { helpId } from '../ids.ts';
import { HELP } from '../styles.ts';

export interface ToggleFieldProps {
  id: string;
  label: string;
  help?: string;
  why?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleField({ id, label, help, why, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="py-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm font-medium text-ink">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-accent"
          checked={checked}
          aria-describedby={help === undefined ? undefined : helpId(id)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>

      {help !== undefined && (
        <p className={`${HELP} ml-6.5`} id={helpId(id)}>
          {help}
        </p>
      )}
      {why !== undefined && (
        <details className="mt-1.5 ml-6.5 text-sm">
          <summary className="cursor-pointer text-accent-strong underline decoration-dotted">
            Why this matters
          </summary>
          <div className="mt-1.5 text-ink-muted">{why}</div>
        </details>
      )}
    </div>
  );
}
