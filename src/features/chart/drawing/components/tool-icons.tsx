import type { ReactNode } from 'react';
import {
  ArrowRightToLine,
  ArrowUpRight,
  BetweenHorizontalStart,
  CalendarRange,
  ChartNoAxesGantt,
  Minus,
  MoveDiagonal,
  MoveUpRight,
  Rows2,
  Ruler,
  SeparatorVertical,
  Slash,
  Square,
  TrendingDown,
  TrendingUp,
  Type,
} from 'lucide-react';
import type { ToolId } from '../tools';
import { Swings } from './Swings';

const SIZE = 16;

/** The icon of each tool on the drawing bar. */
export const TOOL_ICONS: Readonly<Record<ToolId, ReactNode>> = {
  trendLine: <Slash size={SIZE} aria-hidden="true" />,
  ray: <MoveUpRight size={SIZE} aria-hidden="true" />,
  extendedLine: <MoveDiagonal size={SIZE} aria-hidden="true" />,
  horizontalLine: <Minus size={SIZE} aria-hidden="true" />,
  horizontalRay: <ArrowRightToLine size={SIZE} aria-hidden="true" />,
  verticalLine: <SeparatorVertical size={SIZE} aria-hidden="true" />,
  parallelChannel: <Rows2 size={SIZE} aria-hidden="true" />,
  arrow: <ArrowUpRight size={SIZE} aria-hidden="true" />,
  fibRetracement: <BetweenHorizontalStart size={SIZE} aria-hidden="true" />,
  fibExtension: <ChartNoAxesGantt size={SIZE} aria-hidden="true" />,
  rectangle: <Square size={SIZE} aria-hidden="true" />,
  longPosition: <TrendingUp size={SIZE} aria-hidden="true" />,
  shortPosition: <TrendingDown size={SIZE} aria-hidden="true" />,
  priceRange: <Ruler size={SIZE} aria-hidden="true" />,
  dateRange: <CalendarRange size={SIZE} aria-hidden="true" />,
  text: <Type size={SIZE} aria-hidden="true" />,
  xabcd: (
    <Swings
      fill
      points={[
        [1, 13],
        [5, 3],
        [8, 10],
        [11, 6],
        [15, 14],
      ]}
    />
  ),
  cypher: (
    <Swings
      fill
      points={[
        [1, 14],
        [4, 6],
        [7, 10],
        [11, 2],
        [15, 11],
      ]}
    />
  ),
  abcd: (
    <Swings
      points={[
        [2, 13],
        [6, 4],
        [10, 9],
        [14, 2],
      ]}
    />
  ),
  threeDrives: (
    <Swings
      points={[
        [1, 14],
        [4, 9],
        [6, 11],
        [9, 6],
        [11, 8],
        [15, 2],
      ]}
    />
  ),
  headAndShoulders: (
    <Swings
      points={[
        [1, 14],
        [4, 7],
        [6, 10],
        [8, 2],
        [10, 10],
        [12, 7],
        [15, 14],
      ]}
    />
  ),
  trianglePattern: (
    <Swings
      points={[
        [1, 2],
        [5, 14],
        [9, 5],
        [13, 11],
        [15, 8],
      ]}
    />
  ),
  elliottImpulse: (
    <Swings
      points={[
        [1, 15],
        [4, 9],
        [6, 12],
        [10, 3],
        [12, 6],
        [15, 1],
      ]}
    />
  ),
  elliottCorrection: (
    <Swings
      points={[
        [2, 2],
        [6, 10],
        [10, 6],
        [14, 14],
      ]}
    />
  ),
  elliottTriangle: (
    <Swings
      points={[
        [1, 2],
        [4, 14],
        [7, 4],
        [10, 12],
        [12, 6],
        [15, 10],
      ]}
    />
  ),
  elliottDoubleCombo: (
    <Swings
      points={[
        [2, 3],
        [6, 12],
        [10, 7],
        [14, 13],
      ]}
    />
  ),
  elliottTripleCombo: (
    <Swings
      points={[
        [1, 3],
        [4, 11],
        [7, 7],
        [10, 13],
        [12, 9],
        [15, 14],
      ]}
    />
  ),
};
