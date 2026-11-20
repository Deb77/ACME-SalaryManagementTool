import type { Story } from '@ladle/react';
import { useState } from 'react';
import { SegmentedControl } from '../components';

export default { title: 'Atoms / Segmented control' };

export const Segmented: Story = () => {
  const [period, setPeriod] = useState<'3m' | '12m' | 'all'>('12m');
  return (
    <SegmentedControl
      label="Period"
      value={period}
      onChange={setPeriod}
      options={[
        { value: '3m', label: '3M' },
        { value: '12m', label: '12M' },
        { value: 'all', label: 'All' },
      ]}
    />
  );
};
