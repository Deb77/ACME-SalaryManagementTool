import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartColors, fonts } from '../../../theme/tokens';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendChartProps {
  /** One-sentence takeaway for screen readers, e.g. "Payroll rose 5.1% in 12 months". */
  summary: string;
  data: readonly TrendPoint[];
  formatValue: (value: number) => string;
  height?: number;
}

const AXIS_TICK = { fill: chartColors.axis, fontSize: 12, fontFamily: fonts.sans };

/** Area chart for a single series over time (payroll trend). */
export function TrendChart({ summary, data, formatValue, height = 240 }: TrendChartProps) {
  const gradientId = useId();
  return (
    <figure role="img" aria-label={summary} style={{ margin: 0, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.areaFrom} stopOpacity={0.28} />
              <stop offset="100%" stopColor={chartColors.areaFrom} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="4 4" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={formatValue}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(value) => formatValue(Number(value))}
            contentStyle={{ borderRadius: 12, fontFamily: fonts.sans }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={chartColors.line}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
