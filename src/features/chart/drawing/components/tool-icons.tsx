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
};
