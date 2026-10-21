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
 * labelled range, with four adjustable assumptions and an explanation of each.
 * The explanations are not decoration: a user who does not know that common
 * stock sits behind the preferred stack has no way to judge whether a 30%
 * discount is right for their company, and the whole exercise is worthless if
 * the haircuts are taken on faith. See `EquityScenarioPanel`.
 */

import { DEFAULT_VEST_YEARS, LIQUIDITY_PROBABILITY_BY_STAGE } from '../../engine/constants.ts';
import { PRIVATE_EQUITY_ASSUMPTION_DEFAULTS } from '../../engine/equity.ts';
import type { EquityInput, FundingStage } from '../../engine/types.ts';
import { EquityScenarioPanel } from '../EquityScenarioPanel.tsx';
import { Section } from '../Section.tsx';
import { sumCategories } from '../contributions.ts';
import { CurrencyField } from '../fields/CurrencyField.tsx';
import { NumberField } from '../fields/NumberField.tsx';
import { RateField } from '../fields/RateField.tsx';
import { SelectField } from '../fields/SelectField.tsx';
import { ToggleField } from '../fields/ToggleField.tsx';
import { formatDollars, formatPercent } from '../format.ts';
import type { InputSectionProps } from './props.ts';

/** `null` is a real answer here, so it needs a value the `<select>` can hold. */
const UNSPECIFIED = 'unspecified';

const STAGE_LABELS: Record<FundingStage, string> = {
  seed: 'Seed',
  series_a: 'Series A',
  series_b: 'Series B',
  series_c: 'Series C',
  series_d_plus: 'Series D or later',
};

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
                  showExpectedValue: false,
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
        why="A public RSU has an observable price, so its value is a fact. A private share has no
             price, so a single number would be a guess presented as a fact — it gets a range
             instead. An option is a right to buy, so only the spread over the strike counts, and
             even that ignores what exercising would cost you."
        onChange={changeMode}
      />

      {equity.type === 'unknown' && (
        <p className="py-3 text-sm text-ink-muted">
          Counted as $0, which makes your headline a floor: your package is worth at least that much
          and probably more. That is the honest treatment of a number nobody has given you — and
          &ldquo;ask what the strike price and the last round&rsquo;s valuation were&rdquo; is a
          reasonable thing to take back to a recruiter.
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
            why="RSUs are taxed as ordinary income at the price on the day they vest, which is also
                 the day you could sell them. That makes them the one kind of equity genuinely
                 comparable to salary — and it is why the price you enter should be today's, not
                 the one in your offer letter."
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
            why="Nothing vests before the cliff. A twelve-month cliff makes the whole first year's
                 equity contingent on still being there, which the result panel flags — the figure
                 is right, but it is not money you have yet."
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
            why="Only the spread between this and the strike is counted, and it is floored at zero:
                 an underwater option is worth nothing today, never a liability. The figure also
                 ignores two real things — what exercising would cost you in cash, and the value of
                 the remaining time on the option, which cannot be priced here without a
                 volatility assumption this app has no source for."
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
            why="ISOs can trigger alternative minimum tax on the spread in the year you exercise,
                 even if you sell nothing and receive no cash — people have owed five-figure tax
                 bills on paper gains that later evaporated. NSOs are taxed as ordinary income at
                 exercise, which is simpler and usually cheaper to be surprised by."
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
            why="This is the number recruiters multiply your shares by, and it is the wrong one:
                 investors bought preferred stock, which gets paid first and carries protections
                 your common stock does not. It is the right starting point, but only a starting
                 point — the two haircuts below exist to take it apart."
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
            why="Investors hold preferred stock: in a sale they get their money back before common
                 shareholders get anything, and they often hold protections that pay them more than
                 their share. Your common stock is behind all of that, so it is worth less per
                 share than the last round implies — 20–40% less is the usual range, and
                 dramatically more if the company has raised a lot of money relative to what it
                 might sell for."
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
            why="Every round issues new shares, so your slice shrinks even though your share count
                 does not. A company that will raise two more rounds before any exit will dilute
                 you by something like 20–40% in total. This is the haircut people forget entirely,
                 because nothing in your grant paperwork mentions it."
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
            why="An editorial judgment, not a finding: 3× the last round is a good outcome that
                 happens often enough to be worth planning around, where a 50× outcome is a
                 lottery ticket. Change it if you have a specific reason — it moves only the top
                 row of the range."
            onChange={(strongMultiple) =>
              dispatch({ type: 'setEquity', equity: { ...equity, strongMultiple } })
            }
          />

          <SelectField
            id="funding-stage"
            label="Funding stage when you were granted"
            value={equity.stage ?? UNSPECIFIED}
            options={[
              { value: UNSPECIFIED, label: 'Not sure' },
              ...(Object.keys(STAGE_LABELS) as FundingStage[]).map((stage) => ({
                value: stage,
                label: `${STAGE_LABELS[stage]} — ${formatPercent(
                  LIQUIDITY_PROBABILITY_BY_STAGE[stage]
                )} reach liquidity`,
              })),
            ]}
            help="Used only to pick a liquidity probability, and only if you have not entered one."
            why="Later-stage companies exit more often, and the observed rates are the one sourced
                 figure in this section — everything else here is a judgment. Stage is not a
                 guarantee in either direction: plenty of Series D companies have gone to zero."
            onChange={(stage) =>
              dispatch({
                type: 'setEquity',
                equity: {
                  ...equity,
                  stage: stage === UNSPECIFIED ? null : (stage as FundingStage),
                },
              })
            }
          />

          <ToggleField
            id="liquidity-own"
            label="I want to set the liquidity probability myself"
            checked={equity.liquidityProbability !== null}
            help="Otherwise it comes from the funding stage above, or from a conservative default."
            onChange={(own) =>
              dispatch({
                type: 'setEquity',
                // `null` means "derive it" and `0` means "this will never exit",
                // which is why this is a toggle and not a field where 0 stands
                // in for no answer.
                equity: { ...equity, liquidityProbability: own ? 0.2 : null },
              })
            }
          />

          {equity.liquidityProbability !== null && (
            <RateField
              id="liquidity-probability"
              label="Chance of any liquidity event"
              max={1}
              value={equity.liquidityProbability}
              help="An acquisition or IPO at any price. 0% is a legitimate answer."
              onChange={(liquidityProbability) =>
                dispatch({ type: 'setEquity', equity: { ...equity, liquidityProbability } })
              }
            />
          )}

          <ToggleField
            id="show-expected-value"
            label="Show the probability-weighted figure"
            checked={equity.showExpectedValue}
            help="Off by default. It never enters the headline either way."
            why="Multiplying the middle outcome by the chance of any exit gives a mathematically
                 defensible average that describes nobody's actual year: you do not get the average
                 of many outcomes, you get one. It is useful for comparing two offers and
                 misleading as a figure to plan around, which is why it is opt-in."
            onChange={(showExpectedValue) =>
              dispatch({ type: 'setEquity', equity: { ...equity, showExpectedValue } })
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
