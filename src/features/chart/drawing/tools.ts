import type { Decimal, DrawingStyle, DrawingType } from '../../../types/domain';

/**
 * The tools of the drawing bar (D-149 (2)). A ray and an extended line are
 * trend lines whose style extends them, so a tool is a drawing type plus a
 * preset of its style.
 */
export type ToolId =
  | 'trendLine'
  | 'ray'
  | 'extendedLine'
  | 'horizontalLine'
  | 'horizontalRay'
  | 'verticalLine'
  | 'parallelChannel'
  | 'arrow'
  | 'fibRetracement'
  | 'fibExtension'
  | 'rectangle'
  | 'longPosition'
  | 'shortPosition'
  | 'priceRange'
  | 'dateRange'
  | 'text'
  | 'xabcd'
  | 'cypher'
  | 'abcd'
  | 'threeDrives'
  | 'headAndShoulders'
  | 'trianglePattern'
  | 'elliottImpulse'
  | 'elliottCorrection'
  | 'elliottTriangle'
  | 'elliottDoubleCombo'
  | 'elliottTripleCombo';

export interface Tool {
  id: ToolId;
  type: DrawingType;
  style?: Partial<DrawingStyle>;
}

const PATTERN_STYLE: Partial<DrawingStyle> = {
  lineColor: '#2962FF',
  fillColor: '#2962FF26',
};
const WAVE_STYLE: Partial<DrawingStyle> = { lineColor: '#FF9800' };

export const TOOLS: Readonly<Record<ToolId, Tool>> = {
  trendLine: { id: 'trendLine', type: 'TREND_LINE' },
  ray: { id: 'ray', type: 'TREND_LINE', style: { extendRight: true } },
  extendedLine: {
    id: 'extendedLine',
    type: 'TREND_LINE',
    style: { extendLeft: true, extendRight: true },
  },
  horizontalLine: { id: 'horizontalLine', type: 'HORIZONTAL_LINE' },
  horizontalRay: { id: 'horizontalRay', type: 'HORIZONTAL_RAY' },
  verticalLine: { id: 'verticalLine', type: 'VERTICAL_LINE' },
  parallelChannel: {
    id: 'parallelChannel',
    type: 'PARALLEL_CHANNEL',
    style: { fillColor: '#2962FF1A' },
  },
  arrow: { id: 'arrow', type: 'ARROW' },
  fibRetracement: {
    id: 'fibRetracement',
    type: 'FIB_RETRACEMENT',
    style: { lineColor: '#787B86' },
  },
  fibExtension: {
    id: 'fibExtension',
    type: 'FIB_EXTENSION',
    style: { lineColor: '#787B86' },
  },
  rectangle: {
    id: 'rectangle',
    type: 'RECTANGLE',
    style: { lineColor: '#9C27B0', fillColor: '#9C27B033' },
  },
  longPosition: { id: 'longPosition', type: 'LONG_POSITION' },
  shortPosition: { id: 'shortPosition', type: 'SHORT_POSITION' },
  priceRange: {
    id: 'priceRange',
    type: 'PRICE_RANGE',
    style: { fillColor: '#2962FF1A' },
  },
  dateRange: {
    id: 'dateRange',
    type: 'DATE_RANGE',
    style: { fillColor: '#2962FF1A' },
  },
  text: { id: 'text', type: 'TEXT', style: { fontSize: 14 } },
  xabcd: { id: 'xabcd', type: 'XABCD_PATTERN', style: PATTERN_STYLE },
  cypher: { id: 'cypher', type: 'CYPHER_PATTERN', style: PATTERN_STYLE },
  abcd: { id: 'abcd', type: 'ABCD_PATTERN', style: { lineColor: '#26A69A' } },
  threeDrives: {
    id: 'threeDrives',
    type: 'THREE_DRIVES_PATTERN',
    style: { lineColor: '#9C27B0' },
  },
  headAndShoulders: {
    id: 'headAndShoulders',
    type: 'HEAD_AND_SHOULDERS',
    style: { lineColor: '#26A69A', fillColor: '#26A69A26' },
  },
  trianglePattern: {
    id: 'trianglePattern',
    type: 'TRIANGLE_PATTERN',
    style: { lineColor: '#FF9800', fillColor: '#FF980026' },
  },
  elliottImpulse: {
    id: 'elliottImpulse',
    type: 'ELLIOTT_IMPULSE_WAVE',
    style: WAVE_STYLE,
  },
  elliottCorrection: {
    id: 'elliottCorrection',
    type: 'ELLIOTT_CORRECTION_WAVE',
    style: WAVE_STYLE,
  },
  elliottTriangle: {
    id: 'elliottTriangle',
    type: 'ELLIOTT_TRIANGLE_WAVE',
    style: WAVE_STYLE,
  },
  elliottDoubleCombo: {
    id: 'elliottDoubleCombo',
    type: 'ELLIOTT_DOUBLE_COMBO',
    style: WAVE_STYLE,
  },
  elliottTripleCombo: {
    id: 'elliottTripleCombo',
    type: 'ELLIOTT_TRIPLE_COMBO',
    style: WAVE_STYLE,
  },
};

/** The tool a drawing of the type was made with, a trend line aside. */
export function toolOfType(type: DrawingType): ToolId {
  return Object.values(TOOLS).find((tool) => tool.type === type)!.id;
}

/** The groups of the bar, each opening on the tool used last in it. */
export const TOOL_GROUPS = [
  {
    id: 'lines',
    tools: [
      'trendLine',
      'ray',
      'extendedLine',
      'horizontalLine',
      'horizontalRay',
      'verticalLine',
      'parallelChannel',
      'arrow',
    ],
  },
  { id: 'fibonacci', tools: ['fibRetracement', 'fibExtension'] },
  { id: 'shapes', tools: ['rectangle'] },
  { id: 'positions', tools: ['longPosition', 'shortPosition'] },
  { id: 'measure', tools: ['priceRange', 'dateRange'] },
  {
    id: 'patterns',
    tools: [
      'xabcd',
      'cypher',
      'abcd',
      'threeDrives',
      'headAndShoulders',
      'trianglePattern',
    ],
  },
  {
    id: 'elliott',
    tools: [
      'elliottImpulse',
      'elliottCorrection',
      'elliottTriangle',
      'elliottDoubleCombo',
      'elliottTripleCombo',
    ],
  },
  { id: 'annotation', tools: ['text'] },
] as const satisfies readonly { id: string; tools: readonly ToolId[] }[];

export type ToolGroupId = (typeof TOOL_GROUPS)[number]['id'];

/** How many anchors fix each type, as the backend checks. */
export const ANCHORS: Readonly<Record<DrawingType, number>> = {
  TREND_LINE: 2,
  HORIZONTAL_LINE: 1,
  HORIZONTAL_RAY: 1,
  VERTICAL_LINE: 1,
  RECTANGLE: 2,
  FIB_RETRACEMENT: 2,
  LONG_POSITION: 3,
  SHORT_POSITION: 3,
  TEXT: 1,
  PARALLEL_CHANNEL: 3,
  FIB_EXTENSION: 3,
  PRICE_RANGE: 2,
  DATE_RANGE: 2,
  ARROW: 2,
  XABCD_PATTERN: 5,
  CYPHER_PATTERN: 5,
  ABCD_PATTERN: 4,
  THREE_DRIVES_PATTERN: 6,
  HEAD_AND_SHOULDERS: 7,
  TRIANGLE_PATTERN: 4,
  ELLIOTT_IMPULSE_WAVE: 6,
  ELLIOTT_CORRECTION_WAVE: 4,
  ELLIOTT_TRIANGLE_WAVE: 6,
  ELLIOTT_DOUBLE_COMBO: 4,
  ELLIOTT_TRIPLE_COMBO: 6,
};

/**
 * Anchors the Trader clicks; the others follow from them. A position is
 * placed with one click at its entry and gets a stop and target around it,
 * which the Trader then drags, as on an exchange chart.
 */
export const CLICKS: Readonly<Record<DrawingType, number>> = {
  ...ANCHORS,
  LONG_POSITION: 1,
  SHORT_POSITION: 1,
};

/** The retracement levels shown by default. */
export const FIB_RETRACEMENT_LEVELS: readonly Decimal[] = [
  '0',
  '0.236',
  '0.382',
  '0.5',
  '0.618',
  '0.786',
  '1',
];

/** The extension levels shown by default. */
export const FIB_EXTENSION_LEVELS: readonly Decimal[] = [
  '0',
  '0.618',
  '1',
  '1.618',
  '2.618',
];

export const DEFAULT_STYLE: DrawingStyle = {
  lineColor: '#2962FF',
  lineWidth: 2,
  lineStyle: 'SOLID',
  fillColor: null,
  extendLeft: false,
  extendRight: false,
  fontSize: null,
  fibLevels: null,
};

/** The style a new drawing of the tool starts with. */
export function styleOf(tool: ToolId): DrawingStyle {
  return { ...DEFAULT_STYLE, ...TOOLS[tool].style };
}

/** Types whose zone is filled. */
export const FILLED: ReadonlySet<DrawingType> = new Set([
  'RECTANGLE',
  'PARALLEL_CHANNEL',
  'PRICE_RANGE',
  'DATE_RANGE',
  'XABCD_PATTERN',
  'CYPHER_PATTERN',
  'HEAD_AND_SHOULDERS',
  'TRIANGLE_PATTERN',
]);

/** Types whose line may extend past its anchors. */
export const EXTENDABLE: ReadonlySet<DrawingType> = new Set([
  'TREND_LINE',
  'RECTANGLE',
  'PARALLEL_CHANNEL',
  'FIB_RETRACEMENT',
  'FIB_EXTENSION',
]);

/** The palette of the floating bar. */
export const PALETTE: readonly string[] = [
  '#2962FF',
  '#26A69A',
  '#EF5350',
  '#FF9800',
  '#9C27B0',
  '#787B86',
  '#FFFFFF',
  '#000000',
];
