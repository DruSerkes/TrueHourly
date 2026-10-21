/**
 * Where the number came from: every line item, grouped by category, with its
 * contribution in whatever mode the user is viewing.
 *
 * This is the part that makes the headline arguable. A single big figure with
 * no derivation is a thing to believe or not; a figure with its rows shown is a
 * figure someone can check against their own benefits summary and correct. Only
 * the second kind is useful for deciding between two jobs.
 *
 * Two deliberate choices:
 *
 *   - The stacked bar is `aria-hidden`. It encodes the same proportions the
 *     group subtotals beside it already state in words, and a decorative bar
 *     announced as a list of nine percentages is noise.
 *   - Line-item notes are shown inline, not hidden behind a disclosure. They
 *     are where the caveats live ("priced at 229 days actually worked",
 *     "target, not guaranteed"), and a caveat nobody opens is a caveat that is
 *     not doing its job.
 */

import type { Category, LineItem } from '../engine/types.ts';
import { ConfidenceBadge } from './ConfidenceBadge.tsx';
import { formatDollars } from './format.ts';
import { valueOf } from './valueMode.ts';
import type { ValueMode } from './valueMode.ts';

/** Display order. Cash first because it is what the user came in thinking about. */
const CATEGORY_ORDER: readonly Category[] = [
  'cash',
  'equity',
  'retirement',
  'health',
  'insurance',
  'perks',
  'leave',
];

const CATEGORY_LABELS: Record<Category, string> = {
  cash: 'Cash',
  equity: 'Equity',
  retirement: 'Retirement & savings',
  health: 'Health',
  insurance: 'Insurance',
  perks: 'Perks & stipends',
  leave: 'Leave',
};

export interface BreakdownProps {
  lineItems: readonly LineItem[];
  mode: ValueMode;
  total: number;
}

export function Breakdown({ lineItems, mode, total }: BreakdownProps) {
  const groups = CATEGORY_ORDER.map((category) => {
    const items = lineItems.filter((item) => item.category === category);
    const subtotal = items.reduce((sum, item) => sum + valueOf(item, mode), 0);
    return { category, items, subtotal };
  }).filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nothing entered yet. Add a base salary above and the breakdown appears here.
      </p>
    );
  }

  return (
    <div>
      {total > 0 && (
        <div
          aria-hidden="true"
          className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2"
        >
          {groups.map((group, index) => (
            <div
              key={group.category}
              className="bg-accent"
              style={{
                width: `${(group.subtotal / total) * 100}%`,
                opacity: 1 - index * 0.13,
              }}
            />
          ))}
        </div>
      )}

      {/* Each group is `div > dt + dd`, with the category and its subtotal in
          the `dt` and the itemised rows in the `dd`. The obvious markup — a
          flex `div` holding `dt` and `dd`, with the row list beside them — is
          invalid: inside a `<dl>`, a `div` may contain only `dt` and `dd`, and
          those must be its direct children. Lighthouse flags it, and the reason
          it matters is that assistive technology pairs terms with definitions
          structurally, so a malformed list is one that announces its pairs
          wrongly or not at all. */}
      <dl className="divide-y divide-line">
        {groups.map((group) => (
          <div key={group.category} className="py-2.5 first:pt-0">
            <dt className="flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
              <span>{CATEGORY_LABELS[group.category]}</span>
              <span className="tabular-nums">
                {formatDollars(group.subtotal)}
                {total > 0 && (
                  <span className="ml-2 font-normal text-ink-faint">
                    {Math.round((group.subtotal / total) * 100)}%
                  </span>
                )}
              </span>
            </dt>

            <dd className="m-0">
              <ul className="mt-1 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-ink-muted">
                        {item.label}
                        <ConfidenceBadge confidence={item.confidence} />
                      </span>
                      <span
                        className={`shrink-0 text-sm tabular-nums ${
                          item.confidence === 'entered'
                            ? 'text-ink-muted'
                            : 'text-ink-muted italic underline decoration-dashed underline-offset-2'
                        }`}
                      >
                        {formatDollars(valueOf(item, mode))}
                      </span>
                    </div>
                    {item.note !== undefined && (
                      <p className="mt-0.5 text-xs text-ink-faint">{item.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}

        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-sm font-semibold text-ink">
            Total {mode === 'faceValue' ? 'compensation' : 'salary-equivalent'}
          </dt>
          <dd className="m-0 text-base font-semibold text-ink tabular-nums">
            {formatDollars(total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
