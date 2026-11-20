import type { Story } from '@ladle/react';
import { HistogramChart, TrayCard, TrendChart } from '../components';
import { payrollTrend, salaryBins } from './sampleData';

export default { title: 'Organisms / Charts' };

export const PayrollTrend: Story = () => (
  <TrayCard title="Payroll trend" footer="Dec 2025 – Nov 2026">
    <TrendChart
      summary="Monthly payroll rose from $57.9M to $60.9M over 12 months"
      data={payrollTrend}
      formatValue={(value) => `$${value.toFixed(1)}M`}
    />
  </TrayCard>
);

export const SalarySpread: Story = () => (
  <TrayCard title="Salary spread · India" footer="₹ lakh per year · darker bar holds the median">
    <HistogramChart
      summary="2,412 India salaries in ₹5 lakh bands; most fall between ₹5 and ₹15 lakh"
      bins={salaryBins}
      highlightIndex={2}
    />
  </TrayCard>
);
