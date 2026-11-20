import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
} from 'recharts';
import { chartColors, fonts } from '../../../theme/tokens';

export interface HistogramBin {
  label: string;
  count: number;
}

export interface HistogramChartProps {
  /** One-sentence takeaway for screen readers. */
  summary: string;
  bins: readonly HistogramBin[];
  /** Bin that holds the median, drawn in the darker accent. */
  highlightIndex?: number;
  height?: number;
}

const AXIS_TICK = { fill: chartColors.axis, fontSize: 12, fontFamily: fonts.sans };

/** Salary spread: headcount per salary band, with the median band highlighted. */
export function HistogramChart({
  summary,
  bins,
  highlightIndex,
  height = 240,
}: HistogramChartProps) {
  return (
    <figure role="img" aria-label={summary} style={{ margin: 0, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...bins]} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="4 4" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Bar dataKey="count" radius={[8, 8, 3, 3]} maxBarSize={44} isAnimationActive={false}>
            <LabelList dataKey="count" position="top" style={AXIS_TICK} />
            {bins.map((bin, index) => (
              <Cell
                key={bin.label}
                fill={index === highlightIndex ? chartColors.highlight : chartColors.barMuted}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
