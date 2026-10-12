import type {
  CandleTimeframe,
  ComponentScores,
  IndicatorName,
  PairAnalysis,
  SetupPreset,
} from '../../types/domain';
import {
  integer,
  nullableDecimal,
  nullableInstant,
  nullableText,
  record,
  text,
} from './decode';
import { marketOf } from './market-dto';

/**
 * Decoder of `GET /analysis/{market}/{symbol}` (SRS 3.3.2, checked against
 * `develop` @ 0d92def). Every value may be null: insufficient history.
 */
const INDICATORS: readonly IndicatorName[] = [
  'sma20',
  'ema20',
  'ema50',
  'ema200',
  'rsi14',
  'macdLine',
  'macdSignal',
  'macdHistogram',
  'bbUpper',
  'bbMiddle',
  'bbLower',
  'volumeSma20',
];
const PRESETS: readonly SetupPreset[] = ['SCALPING', 'DAY_TRADING', 'SWING'];
const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];

function timeframeOf(value: unknown, name: string): CandleTimeframe {
  if (!TIMEFRAMES.includes(value as CandleTimeframe))
    throw new Error(name + ' is not 15m, 1h, 4h or 1d');
  return value as CandleTimeframe;
}

function components(value: unknown, name: string): ComponentScores {
  const scores = record(value, name);
  return {
    formulaVersion: nullableText(scores.formulaVersion, 'formulaVersion'),
    trend: nullableDecimal(scores.trend, 'trend'),
    momentum: nullableDecimal(scores.momentum, 'momentum'),
    volume: nullableDecimal(scores.volume, 'volume'),
    level: nullableDecimal(scores.level, 'level'),
  };
}

export function decodeAnalysis(body: unknown): PairAnalysis {
  const value = record(body);
  const indicators = record(value.indicators, 'indicators');
  const setup = record(value.setupScore, 'setupScore');
  const preset = setup.preset;
  if (!PRESETS.includes(preset as SetupPreset))
    throw new Error('preset is not SCALPING, DAY_TRADING or SWING');
  const score = setup.score === null ? null : integer(setup.score, 'score');
  if (score !== null && (score < 0 || score > 100))
    throw new Error('score is outside 0-100');
  return {
    symbol: text(value.symbol, 'symbol'),
    market: marketOf(value.market),
    timeframe: timeframeOf(value.timeframe, 'timeframe'),
    openTime: nullableInstant(value.openTime, 'openTime'),
    indicators: Object.fromEntries(
      INDICATORS.map((name) => [name, nullableDecimal(indicators[name], name)]),
    ) as Record<IndicatorName, string | null>,
    nearestSupport: nullableDecimal(value.nearestSupport, 'nearestSupport'),
    nearestResistance: nullableDecimal(
      value.nearestResistance,
      'nearestResistance',
    ),
    setupScore: {
      score,
      preset: preset as SetupPreset,
      presetVersion: text(setup.presetVersion, 'presetVersion'),
      timeframe: timeframeOf(setup.timeframe, 'setupScore.timeframe'),
      openTime: nullableInstant(setup.openTime, 'setupScore.openTime'),
      components: components(setup.components, 'setupScore.components'),
    },
  };
}
