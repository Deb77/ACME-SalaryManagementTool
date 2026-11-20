import type { Story } from '@ladle/react';
import { PayRangeRow, TrayCard } from '../components';
import { payByTitle } from './sampleData';

export default { title: 'Molecules / Pay range row' };

/** Sample data is in ₹ lakh; components take minor units (paise). */
const lakhToMinor = (lakh: number) => Math.round(lakh * 100_000 * 100);

export const PayByJobTitle: Story = () => (
  <TrayCard title="Pay by job title" footer="Min–max with median dot">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {payByTitle.map((item) => (
        <PayRangeRow
          key={item.title}
          title={item.title}
          currency="INR"
          minMinor={lakhToMinor(item.min)}
          medianMinor={lakhToMinor(item.median)}
          maxMinor={lakhToMinor(item.max)}
          scaleMinMinor={0}
          scaleMaxMinor={lakhToMinor(75)}
        />
      ))}
    </div>
  </TrayCard>
);

export const EmployeeCurrentPay: Story = () => (
  <TrayCard title="Current pay against role">
    <PayRangeRow
      title="Data Analyst"
      currency="INR"
      minMinor={lakhToMinor(7.2)}
      medianMinor={lakhToMinor(12.6)}
      maxMinor={lakhToMinor(21)}
      markerMinor={lakhToMinor(15)}
    />
  </TrayCard>
);
