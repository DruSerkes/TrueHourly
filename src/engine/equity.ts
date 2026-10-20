/**
 * Equity (DESIGN.md §2.4). Five modes, discriminated on `equity.type`.
 *
 * This is the most opinionated module in the engine, and the opinion is
 * invariant 6: **the app never presents a guess as a fact.** That plays out
 * differently in each mode, and the differences are the point:
 *
 *   `public`   A share price is observable, so the value is a fact. Annualize
 *              the grant and move on. The honesty problem here is not the
 *              number, it is the *shape*: one grant spread over four years
 *              looks like a salary and is not one.
 *   `private`  There is no price, so there is no number — the headline takes
 *              `zero` and the value lives in a labelled scenario range beside
 *              it. This is the single most distinctive thing in the app.
 *   `options`  Intrinsic value only, floored at 0. An option is not a share:
 *              the holder must pay the strike, which the figure ignores.
 *   `unknown`  $0 and a warning. Not an error — a floor.
 *   `none`     Nothing at all. No row, no warning, no scenario panel.
 *
 * What this module deliberately does NOT do: discount for time, model a vesting
 * schedule month by month, or price an option with Black-Scholes. All three
 * need either a clock (invariant 1 forbids it) or a volatility assumption with
 * no source (invariant 5 forbids it). The per-year figure is a flat
 * `grantValue / vestYears`, and the cliff and steady-state warnings exist
 * precisely because that flatness is a simplification the user should see.
 */

import {
  DEFAULT_COMMON_DISCOUNT,
  DEFAULT_EXPECTED_DILUTION,
  DEFAULT_LIQUIDITY_PROBABILITY,
  DEFAULT_STRONG_MULTIPLE,
  LIQUIDITY_PROBABILITY_BY_STAGE,
  MIN_VEST_YEARS,
} from './constants.ts';
import { clamp, dollars, nonNegative } from './numbers.ts';
import {
  equityCliffContingent,
  equityInitialGrantNotSteadyState,
  equityUnknown,
  isoAmtExposure,
  optionsExerciseCost,
  optionsUnderwater,
  privateEquityHeadlineZero,
} from './warnings.ts';
import type {
  EquityContribution,
  EquityInput,
  EquityScenarios,
  LineItemDraft,
  OptionsEquity,
  PrivateEquity,
  PublicEquity,
  Warning,
} from './types.ts';

/**
 * The liquidity probability to use, and where it came from.
 *
 * Three tiers, most specific first:
 *
 *   1. a probability the user typed — they know their company better than a
 *      table does, and `0` is a legitimate answer meaning "this will never
 *      exit", which is why the field is `number | null` and not just `number`
 *   2. the observed rate for the company's funding stage
 *      (`LIQUIDITY_PROBABILITY_BY_STAGE`) — sourced, not invented
 *   3. `DEFAULT_LIQUIDITY_PROBABILITY`, deliberately pitched low because most
 *      startups fail and the base rate across all of them sits nearer the
 *      bottom of the stage table than its middle
 *
 * The basis travels with the number so the UI can say "19%, the observed rate
 * for Series A" rather than presenting a sourced figure, a user's guess, and a
 * fallback as though they were the same kind of claim (invariant 6).
 */
export function resolveLiquidityProbability(equity: PrivateEquity): {
  probability: number;
  basis: EquityScenarios['liquidityProbabilityBasis'];
} {
  const entered = equity.liquidityProbability;
  if (entered !== null) return { probability: clamp(entered, 0, 1), basis: 'entered' };

  if (equity.stage !== null) {
    const byStage = LIQUIDITY_PROBABILITY_BY_STAGE[equity.stage];
    // Guarded because a restored save or a hand-edited URL can hold a stage
    // string that is no longer in the table.
    if (byStage !== undefined) return { probability: byStage, basis: 'stage' };
  }

  return { probability: DEFAULT_LIQUIDITY_PROBABILITY, basis: 'default' };
}

/**
 * Years to spread a grant over, floored at `MIN_VEST_YEARS`.
 *
 * A `vestYears` of 0 is reachable from a half-filled form or a restored save,
 * and `grantValue / 0` is `Infinity` — which Fixture C forbids anywhere in the
 * result. Flooring at one year attributes the whole grant to year one, which is
 * what actually happens when a grant vests immediately.
 */
function vestingYears(vestYears: number): number {
  return Math.max(nonNegative(vestYears), MIN_VEST_YEARS);
}

/**
 * Warnings every grant-shaped mode shares.
 *
 * Both are about the shape of a grant rather than its value, so they apply
 * identically to public shares, private shares, and options — and would be
 * three near-copies if each mode wrote its own.
 */
function grantShapeWarnings(
  grantShares: number,
  vestYears: number,
  cliffMonths: number
): Warning[] {
  if (nonNegative(grantShares) <= 0) return [];

  const warnings: Warning[] = [equityInitialGrantNotSteadyState(vestingYears(vestYears))];
  if (nonNegative(cliffMonths) > 0)
    warnings.unshift(equityCliffContingent(Math.round(cliffMonths)));
  return warnings;
}

// ---------------------------------------------------------------------------
// public
// ---------------------------------------------------------------------------

/** `shares × pricePerShare / vestYears` (DESIGN.md §2.4). */
export function publicEquityPerYear(equity: PublicEquity): number {
  const grantValue = nonNegative(equity.grantShares) * nonNegative(equity.pricePerShare);
  return grantValue / vestingYears(equity.vestYears);
}

function publicEquity(equity: PublicEquity): EquityContribution {
  const perYear = publicEquityPerYear(equity);
  const items: LineItemDraft[] = [];

  if (perYear > 0) {
    items.push({
      id: 'rsu-vesting',
      label: 'RSUs vesting (public)',
      category: 'equity',
      bucket: 'taxable',
      annualValue: dollars(perYear),
      confidence: 'entered',
      note:
        `${Math.round(nonNegative(equity.grantShares)).toLocaleString('en-US')} shares at ` +
        `$${nonNegative(equity.pricePerShare).toLocaleString('en-US')} spread over ` +
        `${vestingYears(equity.vestYears)} years. RSUs are ordinary income at vest, taxed at ` +
        'the price on the day they vest — which is also the day you could sell them, so this ' +
        'is the one kind of equity that really is comparable to salary.',
    });
  }

  return {
    items,
    warnings: grantShapeWarnings(equity.grantShares, equity.vestYears, equity.cliffMonths),
  };
}

// ---------------------------------------------------------------------------
// private
// ---------------------------------------------------------------------------

/**
 * The scenario model (DESIGN.md §2.4).
 *
 *     common  = shares × lastPreferredPrice × (1 − commonDiscount)
 *     diluted = common × (1 − expectedDilution)
 *     perYear = diluted / vestYears
 *
 * Each of the four assumptions is a user-adjustable input defaulting to a
 * figure in `constants.ts`, and every one is echoed back in
 * `scenarios.assumptions` so the UI can show its work without reaching into the
 * input. They are labelled assumptions, not facts — the `strongMultiple` of 3
 * and the fallback `liquidityProbability` in particular are editorial
 * judgments. The stage-based probabilities are the one sourced figure in the
 * set — see `LIQUIDITY_PROBABILITY_BY_STAGE`.
 *
 * Rates are clamped to `[0, 1]`: a discount above 1 flips the sign and turns a
 * worthless grant into a positive number, which is the one failure mode that
 * would make this module actively misleading rather than merely uncertain.
 *
 * `expectedValue` is **0 unless `showExpectedValue` is set**. DESIGN.md §2.4
 * says it is shown "only when the user opts in", and enforcing that here rather
 * than in the UI means the opt-in cannot be lost to a forgotten `if` in a
 * component that does not exist yet. The probability behind it is resolved by
 * `resolveLiquidityProbability` and reported with its provenance.
 */
export function privateEquityScenarios(equity: PrivateEquity): EquityScenarios {
  const commonDiscount = clamp(equity.commonDiscount, 0, 1);
  const expectedDilution = clamp(equity.expectedDilution, 0, 1);
  const strongMultiple = nonNegative(equity.strongMultiple);
  const { probability: liquidityProbability, basis } = resolveLiquidityProbability(equity);

  const preferredValue =
    nonNegative(equity.grantShares) * nonNegative(equity.lastPreferredPricePerShare);
  const common = preferredValue * (1 - commonDiscount);
  const diluted = common * (1 - expectedDilution);
  const perYear = diluted / vestingYears(equity.vestYears);

  return {
    zero: 0,
    modest: perYear,
    strong: perYear * strongMultiple,
    expectedValue: equity.showExpectedValue ? perYear * liquidityProbability : 0,
    liquidityProbabilityBasis: basis,
    // Echoed back whether or not `expectedValue` is shown: the UI needs the
    // figure to label the opt-in itself ("show expected value at 19%").
    assumptions: {
      commonDiscount,
      expectedDilution,
      strongMultiple,
      liquidityProbability,
      vestYears: vestingYears(equity.vestYears),
    },
  };
}

function privateEquityContribution(equity: PrivateEquity): EquityContribution {
  const scenarios = privateEquityScenarios(equity);

  // The headline row is $0 BY DESIGN (DESIGN.md §2.4, invariant 6). It is
  // emitted rather than omitted so the breakdown shows that equity exists and
  // is being counted at zero, instead of looking as though the user forgot to
  // enter it. `confidence: 'unknown'` is what makes the UI render it as such.
  const item: LineItemDraft = {
    id: 'private-equity',
    label: 'Private company equity',
    category: 'equity',
    bucket: 'taxable',
    annualValue: 0,
    confidence: 'unknown',
    note:
      'Counted as $0 in the headline. Most private-company equity ends up worth nothing, and ' +
      'there is no market price to check, so the honest answer is the scenario range shown ' +
      'separately rather than a single number here.',
  };

  const warnings: Warning[] = [
    ...(scenarios.modest > 0 ? [privateEquityHeadlineZero(scenarios.modest)] : []),
    ...grantShapeWarnings(equity.grantShares, equity.vestYears, equity.cliffMonths),
  ];

  return { items: [item], warnings, scenarios };
}

// ---------------------------------------------------------------------------
// options
// ---------------------------------------------------------------------------

/**
 * Intrinsic value per year: `(fmv − strike) × sharesPerYear`, floored at 0.
 *
 * Floored, not allowed to go negative: an underwater option is worth $0 today,
 * never a liability. Showing a negative line item would imply the user owes
 * something, which is the opposite of true — they simply would not exercise.
 */
export function optionsIntrinsicPerYear(equity: OptionsEquity): number {
  const spread = nonNegative(equity.fairMarketValue) - nonNegative(equity.strikePrice);
  const sharesPerYear = nonNegative(equity.grantShares) / vestingYears(equity.vestYears);
  return Math.max(spread, 0) * sharesPerYear;
}

function optionsEquity(equity: OptionsEquity): EquityContribution {
  const shares = nonNegative(equity.grantShares);
  const strike = nonNegative(equity.strikePrice);
  const fmv = nonNegative(equity.fairMarketValue);
  const perYear = optionsIntrinsicPerYear(equity);
  const underwater = shares > 0 && fmv < strike;

  const items: LineItemDraft[] = [];
  if (shares > 0) {
    items.push({
      id: 'options-intrinsic',
      label: `Stock options (${equity.optionClass === 'iso' ? 'ISO' : 'NSO'})`,
      category: 'equity',
      bucket: 'taxable',
      annualValue: dollars(perYear),
      confidence: 'entered',
      note: underwater
        ? `Strike $${strike.toLocaleString('en-US')} against a fair market value of ` +
          `$${fmv.toLocaleString('en-US')}: underwater, so counted as $0 rather than as a ` +
          'negative. The options still have value if the price recovers.'
        : `Intrinsic value only — $${fmv.toLocaleString('en-US')} market value less the ` +
          `$${strike.toLocaleString('en-US')} strike, on the shares vesting each year. It does ` +
          'not subtract the cost of exercising, and it assigns no value to the remaining ' +
          'option time, which is real but unpriceable here.',
    });
  }

  const warnings: Warning[] = [];
  if (underwater) warnings.push(optionsUnderwater(fmv, strike));
  if (shares > 0) warnings.push(optionsExerciseCost(strike * shares, shares));
  if (shares > 0 && equity.optionClass === 'iso') warnings.push(isoAmtExposure());
  warnings.push(...grantShapeWarnings(equity.grantShares, equity.vestYears, equity.cliffMonths));

  return { items, warnings };
}

// ---------------------------------------------------------------------------
// unknown
// ---------------------------------------------------------------------------

function unknownEquity(): EquityContribution {
  return {
    items: [
      {
        id: 'equity-unknown',
        label: 'Equity (value unknown)',
        category: 'equity',
        bucket: 'taxable',
        annualValue: 0,
        confidence: 'unknown',
        note:
          'Counted as $0 because no value was given. The headline is therefore a floor: your ' +
          'package is worth at least this much, and possibly more.',
      },
    ],
    warnings: [equityUnknown()],
  };
}

// ---------------------------------------------------------------------------

/**
 * Every equity line item, warning, and — for a private grant — the scenario
 * range that belongs beside the headline rather than in it.
 *
 * The switch is exhaustive over `EquityInput['type']`; adding a sixth mode to
 * the union is a type error here until it is handled, which is the point of
 * discriminating on `type` instead of carrying optional fields.
 */
export function computeEquityItems(equity: EquityInput): EquityContribution {
  switch (equity.type) {
    case 'none':
      return { items: [], warnings: [] };
    case 'unknown':
      return unknownEquity();
    case 'public':
      return publicEquity(equity);
    case 'private':
      return privateEquityContribution(equity);
    case 'options':
      return optionsEquity(equity);
  }
}

/**
 * The private-equity assumption defaults, in one place for `src/state/` to seed
 * a new input from. Exported from here rather than from `constants.ts` so the
 * grouping lives next to the model that consumes it.
 */
export const PRIVATE_EQUITY_ASSUMPTION_DEFAULTS = {
  commonDiscount: DEFAULT_COMMON_DISCOUNT,
  expectedDilution: DEFAULT_EXPECTED_DILUTION,
  strongMultiple: DEFAULT_STRONG_MULTIPLE,
  // `null`, not the fallback figure: a new input has made no claim about the
  // probability, and seeding it with a number would make an untouched form look
  // like a user who had chosen 20%. `resolveLiquidityProbability` supplies the
  // fallback at the point of use, and reports that it did.
  liquidityProbability: null,
  stage: null,
} as const;
