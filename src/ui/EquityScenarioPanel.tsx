/**
 * The private-equity scenario range (DESIGN.md §2.4).
 *
 * This is the most distinctive thing in the app, and what makes it distinctive
 * is a refusal: there is no market price for a private company's common stock,
 * so the headline counts the grant at **$0** and the value lives here, in a
 * labelled range, next to the assumptions that produced it.
 *
 * The alternative — the thing every offer spreadsheet does — is to multiply
 * shares by the last preferred-round price and put the result in the total. That
 * number is wrong in a specific direction: it ignores that common stock sits
 * behind the preferred stack, that future rounds will dilute it, and that most
 * startups never reach liquidity at all. A grant presented that way is not an
 * estimate, it is a ceiling wearing an estimate's clothes.
 *
 * So the panel shows its work. Every haircut is a user-adjustable assumption
 * with a plain-language explanation, the chain from grant to per-year figure is
 * spelled out.
 */

import type { EquityScenarios, PrivateEquity } from '../engine/types.ts';
import { formatDollars, formatPercent, formatPerShare } from './format.ts';

export interface EquityScenarioPanelProps {
  equity: PrivateEquity;
  scenarios: EquityScenarios;
}

export function EquityScenarioPanel({ equity, scenarios }: EquityScenarioPanelProps) {
  // `assumptions` is a `Record<string, number>` so the engine can echo back
  // whatever the model used without this component and that one having to agree
  // on a second interface. The cost is that every read is `number | undefined`
  // under `noUncheckedIndexedAccess`, so the keys are pulled out once, here,
  // rather than being defaulted at each of the eight places they are rendered.
  const {
    commonDiscount = 0,
    expectedDilution = 0,
    strongMultiple = 1,
    vestYears = 1,
  } = scenarios.assumptions;

  const preferredValue = equity.grantShares * equity.lastPreferredPricePerShare;
  const common = preferredValue * (1 - commonDiscount);
  const diluted = common * (1 - expectedDilution);

  const rows = [
    {
      key: 'zero',
      label: 'It is worth nothing',
      value: scenarios.zero,
      blurb: 'The outcome for most private-company equity. This is what the headline uses.',
    },
    {
      key: 'modest',
      label: 'The last round holds',
      value: scenarios.modest,
      blurb: 'An exit at roughly the valuation of the most recent round, after the haircuts below.',
    },
    {
      key: 'strong',
      label: 'A strong outcome',
      value: scenarios.strong,
      blurb: `An exit at ${strongMultiple}× the last round.`,
    },
  ];

  return (
    <div className="mt-2 rounded-md border border-dashed border-line-strong p-3">
      <h4 className="text-sm font-semibold text-ink">What it might be worth, per year</h4>
      <p className="mt-1 text-sm text-ink-muted">
        Three outcomes rather than one number, because there is no price to look up. The headline
        uses the first one.
      </p>

      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm font-medium text-ink">{row.label}</dt>
              <dd className="text-base font-semibold text-ink tabular-nums">
                {formatDollars(row.value)}
              </dd>
            </div>
            <p className="text-xs text-ink-faint">{row.blurb}</p>
          </div>
        ))}
      </dl>

      {/* The chain, stated. A range nobody can reconstruct is a range nobody
          can argue with, and arguing with it is how a user discovers that their
          own company's dilution assumption should be 40%. */}
      <div className="mt-3 border-t border-line pt-2">
        <h5 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
          How the middle figure is built
        </h5>
        <ol className="mt-1.5 space-y-0.5 text-xs text-ink-muted tabular-nums">
          <li>
            {equity.grantShares.toLocaleString('en-US')} shares ×{' '}
            {formatPerShare(equity.lastPreferredPricePerShare)} preferred ={' '}
            {formatDollars(preferredValue)}
          </li>
          <li>
            less {formatPercent(commonDiscount)} common discount = {formatDollars(common)}
          </li>
          <li>
            less {formatPercent(expectedDilution)} expected dilution = {formatDollars(diluted)}
          </li>
          <li>
            ÷ {vestYears} years of vesting = <strong>{formatDollars(scenarios.modest)}</strong> a
            year
          </li>
        </ol>
      </div>
    </div>
  );
}
