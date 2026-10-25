/**
 * Equity — five modes, and the one screen in this app that does something no
 * offer spreadsheet does.
 *
 * The mode selector is the first field because it changes what the rest of the
 * section even means: a share price is a fact for a public company, an
 * assumption for a private one, and a bet on a spread for an option. Each mode
 * therefore gets its own fields rather than a generic grant form with
 * conditional labels — which is also what the engine's discriminated union
 * demands, since the modes share no common numeric shape.
 *
 * ── Private is the point ────────────────────────────────────────────────
 *
 * For a private grant the headline counts $0 and the value appears as a
 * labelled range, with three adjustable assumptions and an explanation of each.
 * The explanations are not decoration: a user who does not know that common
 * stock sits behind the preferred stack has no way to judge whether a 30%
 * discount is right for their company, and the whole exercise is worthless if
 * the haircuts are taken on faith. See `EquityScenarioPanel`.
 */

import { DEFAULT_VEST_YEARS } from '../../engine/constants.ts';
import { PRIVATE_EQUITY_ASSUMPTION_DEFAULTS } from '../../engine/equity.ts';
import type { EquityInput } from '../../engine/types.ts';
import { EquityScenarioPanel } from '../EquityScenarioPanel.tsx';
import { Section } from '../Section.tsx';
import { sumCategories } from '../contributions.ts';
import { CurrencyField } from '../fields/CurrencyField.tsx';
import { NumberField } from '../fields/NumberField.tsx';
import { RateField } from '../fields/RateField.tsx';
import { SelectField } from '../fields/SelectField.tsx';
import { formatDollars } from '../format.ts';
import type { InputSectionProps } from './props.ts';

const MODE_LABELS: Record<EquityInput['type'], string> = {
  none: 'No equity',
  public: 'Public company RSUs',
  private: 'Private company shares or RSUs',
  options: 'Stock options',
  unknown: 'I have equity but do not know what it is worth',
};

export function EquitySection({ input, result, dispatch, mode }: InputSectionProps) {
  const equity = input.equity;
  const contribution = sumCategories(result.lineItems, mode, ['equity']);
  const scenarios = result.equityScenarios;

  /**
   * Switching mode replaces the union whole. The three fields every grant-shaped
   * mode has in common are carried across, because changing how you describe
   * your equity is not a statement that you have a different amount of it.
   */
  function changeMode(type: EquityInput['type']): void {
    const shares = 'grantShares' in equity ? equity.grantShares : 0;
    const vestYears = 'vestYears' in equity ? equity.vestYears : DEFAULT_VEST_YEARS;
    const cliffMonths = 'cliffMonths' in equity ? equity.cliffMonths : 12;

    const next: EquityInput =
      type === 'none'
        ? { type: 'none' }
        : type === 'unknown'
          ? { type: 'unknown' }
          : type === 'public'
            ? { type: 'public', grantShares: shares, pricePerShare: 0, vestYears, cliffMonths }
            : type === 'options'
              ? {
                  type: 'options',
                  grantShares: shares,
                  strikePrice: 0,
                  fairMarketValue: 0,
                  vestYears,
                  cliffMonths,
                  optionClass: 'iso',
                }
              : {
                  type: 'private',
                  grantShares: shares,
                  lastPreferredPricePerShare: 0,
                  vestYears,
                  cliffMonths,
                  ...PRIVATE_EQUITY_ASSUMPTION_DEFAULTS,
                };

    dispatch({ type: 'setEquity', equity: next });
  }

  return (
    <Section
      id="section-equity"
      title="Equity"
      blurb="RSUs, private-company shares, or options. Each is valued differently, on purpose."
      summary={
        equity.type === 'none'
          ? null
          : equity.type === 'private' || equity.type === 'unknown'
            ? formatDollars(0)
            : contribution > 0
              ? formatDollars(contribution)
              : null
      }
      {...(equity.type === 'private'
        ? { summaryNote: 'in the headline — see the range' }
        : equity.type === 'unknown'
          ? { summaryNote: 'unvalued' }
          : {})}
    >
      <SelectField
        id="equity-type"
        label="What kind of equity do you have?"
        value={equity.type}
        options={(['none', 'public', 'private', 'options', 'unknown'] as const).map((type) => ({
          value: type,
          label: MODE_LABELS[type],
        }))}
        help="This changes how the value is calculated, not just what it is called."
        why="Public RSUs have a market price. Private shares do not, so they get a range. Options count only the gain above the strike price."
        onChange={changeMode}
      />

      {equity.type === 'unknown' && (
        <p className="py-3 text-sm text-ink-muted">
          Counted as $0, which makes your headline a floor: your package is worth at least that much
          and probably more. That is the honest treatment of a number nobody has given you. It's
          reasonable to ask a recruiter what the strike price and the last round's valuation were
        </p>
      )}

      {equity.type === 'public' && (
        <>
          <NumberField
            id="rsu-shares"
            label="Shares in the grant"
            unit="shares"
            value={equity.grantShares}
            help="The whole grant, not the amount vesting each year."
            onChange={(grantShares) =>
              dispatch({ type: 'setEquity', equity: { ...equity, grantShares } })
            }
          />
          <CurrencyField
            id="rsu-price"
            label="Current share price"
            precise
            value={equity.pricePerShare}
            help="Today's market price. This app does not call out for a quote — no input leaves the browser."
            why="RSUs are taxed at the price on the day they vest. Use today's price, not the one in your offer letter."
            onChange={(pricePerShare) =>
              dispatch({ type: 'setEquity', equity: { ...equity, pricePerShare } })
            }
          />
          <NumberField
            id="rsu-vest-years"
            label="Vesting period"
            unit="years"
            min={1}
            max={10}
            value={equity.vestYears}
            help="The grant is spread evenly over these years."
            onChange={(vestYears) =>
              dispatch({ type: 'setEquity', equity: { ...equity, vestYears } })
            }
          />
          <NumberField
            id="rsu-cliff"
            label="Cliff"
            unit="months"
            max={48}
            value={equity.cliffMonths}
            help="Months before the first vest. 12 is common; 0 means it vests from the start."
            why="Nothing vests before the cliff, so your first year of equity depends on staying that long."
            onChange={(cliffMonths) =>
              dispatch({ type: 'setEquity', equity: { ...equity, cliffMonths } })
            }
          />
        </>
      )}

      {equity.type === 'options' && (
        <>
          <NumberField
            id="options-shares"
            label="Options in the grant"
            unit="options"
            value={equity.grantShares}
            help="The whole grant."
            onChange={(grantShares) =>
              dispatch({ type: 'setEquity', equity: { ...equity, grantShares } })
            }
          />
          <CurrencyField
            id="options-strike"
            label="Strike price"
            precise
            value={equity.strikePrice}
            help="What you would pay per share to exercise."
            onChange={(strikePrice) =>
              dispatch({ type: 'setEquity', equity: { ...equity, strikePrice } })
            }
          />
          <CurrencyField
            id="options-fmv"
            label="Current fair market value"
            precise
            value={equity.fairMarketValue}
            help="Per share. For a private company this is the latest 409A valuation."
            why="Only the gain above the strike price counts, and never less than zero. The cost of exercising is not included."
            onChange={(fairMarketValue) =>
              dispatch({ type: 'setEquity', equity: { ...equity, fairMarketValue } })
            }
          />
          <SelectField
            id="options-class"
            label="Option type"
            value={equity.optionClass}
            options={[
              { value: 'iso', label: 'ISO — incentive stock option' },
              { value: 'nso', label: 'NSO / NQSO — non-qualified' },
            ]}
            help="On your grant agreement. It changes the tax exposure, not the value."
            why="ISOs can trigger alternative minimum tax when you exercise, even if you do not sell. NSOs are taxed as regular income at exercise."
            onChange={(optionClass) =>
              dispatch({ type: 'setEquity', equity: { ...equity, optionClass } })
            }
          />
          <NumberField
            id="options-vest-years"
            label="Vesting period"
            unit="years"
            min={1}
            max={10}
            value={equity.vestYears}
            help="The grant is spread evenly over these years."
            onChange={(vestYears) =>
              dispatch({ type: 'setEquity', equity: { ...equity, vestYears } })
            }
          />
          <NumberField
            id="options-cliff"
            label="Cliff"
            unit="months"
            max={48}
            value={equity.cliffMonths}
            help="Months before the first vest."
            onChange={(cliffMonths) =>
              dispatch({ type: 'setEquity', equity: { ...equity, cliffMonths } })
            }
          />
        </>
      )}

      {equity.type === 'private' && (
        <>
          <div className="py-3 text-sm text-ink-muted">
            <p>
              Private shares are counted as <strong className="text-ink">$0</strong> in your
              headline rate. Not because they are worthless — because there is no price to look up,
              most private equity ends up worth nothing, and a single confident number here would be
              the least trustworthy figure on the page.
            </p>
            <p className="mt-1.5">
              What you get instead is a range, built from assumptions you can see and change.
            </p>
          </div>

          <NumberField
            id="private-shares"
            label="Shares or units in the grant"
            unit="shares"
            value={equity.grantShares}
            help="The whole grant."
            onChange={(grantShares) =>
              dispatch({ type: 'setEquity', equity: { ...equity, grantShares } })
            }
          />
          <CurrencyField
            id="private-price"
            label="Last preferred-round price per share"
            precise
            value={equity.lastPreferredPricePerShare}
            help="What investors paid in the most recent round. Ask — many companies will tell you."
            why="The price recruiters quote, but it is for investors' preferred stock. Your common stock is worth less, which the adjustments below account for."
            onChange={(lastPreferredPricePerShare) =>
              dispatch({ type: 'setEquity', equity: { ...equity, lastPreferredPricePerShare } })
            }
          />
          <NumberField
            id="private-vest-years"
            label="Vesting period"
            unit="years"
            min={1}
            max={10}
            value={equity.vestYears}
            help="The grant is spread evenly over these years."
            onChange={(vestYears) =>
              dispatch({ type: 'setEquity', equity: { ...equity, vestYears } })
            }
          />
          <NumberField
            id="private-cliff"
            label="Cliff"
            unit="months"
            max={48}
            value={equity.cliffMonths}
            help="Months before the first vest."
            onChange={(cliffMonths) =>
              dispatch({ type: 'setEquity', equity: { ...equity, cliffMonths } })
            }
          />

          <RateField
            id="common-discount"
            label="Common-stock discount"
            max={1}
            value={equity.commonDiscount}
            help="How much less your common stock is worth than the preferred price. Default 30%."
            why="Investors get paid back before common shareholders in a sale, so common stock is usually worth 20–40% less per share."
            onChange={(commonDiscount) =>
              dispatch({ type: 'setEquity', equity: { ...equity, commonDiscount } })
            }
          />

          <RateField
            id="expected-dilution"
            label="Expected future dilution"
            max={1}
            value={equity.expectedDilution}
            help="How much of your stake future funding rounds will take. Default 25%."
            why="Each funding round issues new shares and shrinks your slice. Two more rounds typically dilutes you 20–40%."
            onChange={(expectedDilution) =>
              dispatch({ type: 'setEquity', equity: { ...equity, expectedDilution } })
            }
          />

          <NumberField
            id="strong-multiple"
            label="Strong-outcome multiple"
            unit="× the last round"
            min={1}
            max={100}
            value={equity.strongMultiple}
            help="Used only for the optimistic scenario. Default 3×."
            why="3× the last round is a good, realistic outcome; 50× is a lottery ticket. This only changes the top of the range."
            onChange={(strongMultiple) =>
              dispatch({ type: 'setEquity', equity: { ...equity, strongMultiple } })
            }
          />

          {scenarios !== undefined && (
            <div className="py-3">
              <EquityScenarioPanel equity={equity} scenarios={scenarios} />
            </div>
          )}
        </>
      )}
    </Section>
  );
}
