/**
 * A labelled `<select>` for the input's enum-shaped fields — PTO plan type,
 * coverage tier, equity mode, option class, funding stage, stipend treatment.
 *
 * A native select rather than a styled listbox, deliberately. Every one of
 * these is a short list of mutually exclusive options with no need for search,
 * grouping, or multi-select, and the native control already has keyboard
 * support, type-ahead, platform-correct touch behaviour, and the user's own
 * zoom and font settings. A custom replacement would be more code whose best
 * case is parity.
 *
 * Options are typed to the union they set, so a mode the component offers but
 * the engine does not handle is a type error rather than a silent no-op.
 */

import type { ReactNode } from 'react';
import { helpId } from '../ids.ts';
import { INPUT } from '../styles.ts';
import { FieldShell } from './FieldShell.tsx';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  help?: string;
  why?: ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  id,
  label,
  help,
  why,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <FieldShell
      id={id}
      label={label}
      {...(help === undefined ? {} : { help })}
      {...(why === undefined ? {} : { why })}
    >
      <select
        id={id}
        className={`${INPUT} pr-8`}
        value={value}
        aria-describedby={help === undefined ? undefined : helpId(id)}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
