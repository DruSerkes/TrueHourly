/**
 * The engine's warnings, rendered as the engine stated them.
 *
 * Nothing here interprets. `Warning` carries an id, a severity and a
 * user-facing sentence, and the component's whole job is to decide where that
 * sentence sits on the page. DESIGN.md §2.5 put the wording in the engine so
 * that it is testable and so that two surfaces cannot word the same caveat two
 * ways — a component that rephrased a message would quietly take that back.
 *
 * Severity is conveyed by the word "Caution" or "Note", not by colour alone.
 * The colour is a second channel, never the only one.
 */

import type { Warning } from '../engine/types.ts';

export function WarningList({ warnings }: { warnings: readonly Warning[] }) {
  if (warnings.length === 0) return null;

  return (
    <section aria-labelledby="warnings-heading">
      <h3 className="text-sm font-semibold text-ink" id="warnings-heading">
        Things to know
      </h3>
      <ul className="mt-2 space-y-2">
        {warnings.map((warning) => {
          const caution = warning.severity === 'caution';
          return (
            <li
              key={warning.id}
              className={`rounded-md border-l-4 px-3 py-2 text-sm ${
                caution
                  ? 'border-caution bg-caution-soft text-ink'
                  : 'border-line-strong bg-surface-2 text-ink-muted'
              }`}
            >
              <span className={`font-semibold ${caution ? 'text-caution' : 'text-ink'}`}>
                {caution ? 'Caution' : 'Note'}:{' '}
              </span>
              {warning.message}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
