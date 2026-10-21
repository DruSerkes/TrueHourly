/**
 * The chrome every input shares: a label bound to the control, a help line the
 * control points at with `aria-describedby`, and the plain-language "why this
 * matters" disclosure DESIGN.md §6 calls the product for a first-time visitor.
 *
 * It exists so the association cannot be forgotten. A `<label htmlFor>` that
 * does not match an `id`, or help text a screen reader never reaches because
 * nothing described it, are both invisible in a browser and both failures — so
 * the ids are derived from one `id` prop here and handed back to the caller
 * rather than written out twice.
 */

import type { ReactNode } from 'react';
import { helpId } from '../ids.ts';
import { HELP, LABEL } from '../styles.ts';

export interface FieldShellProps {
  /** Base id; the control uses it, the help text uses `${id}-help`. */
  id: string;
  label: string;
  /** One-line help, always visible. Describes the units, not the rationale. */
  help?: string;
  /** The longer "why this matters" explanation, behind a disclosure. */
  why?: ReactNode;
  /** Rendered with `aria-describedby` already pointing at the help text. */
  children: ReactNode;
}

export function FieldShell({ id, label, help, why, children }: FieldShellProps) {
  return (
    <div className="py-3">
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {help !== undefined && (
        <p className={HELP} id={helpId(id)}>
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
