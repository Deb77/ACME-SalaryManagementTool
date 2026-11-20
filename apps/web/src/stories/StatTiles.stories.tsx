import type { Story } from '@ladle/react';
import { StatTile } from '../components';
import { grid } from './layout';

export default { title: 'Molecules / Stat tiles' };

export const Hero: Story = () => (
  <div style={{ maxWidth: 280 }}>
    <StatTile
      variant="hero"
      label="Active employees"
      value="9,500"
      delta="+412"
      deltaTone="positive"
      note="hired in 2026"
      trend={[2980, 2412, 1240, 980, 720, 510, 380, 278]}
    />
  </div>
);

export const Row: Story = () => (
  <div style={grid(220)}>
    <StatTile
      label="Annual payroll"
      value="$730.2M"
      delta="USD"
      note="indicative total"
      trend={[376.7, 46.1, 104.8, 77, 50.9, 39.7, 12.4, 22.6]}
    />
    <StatTile
      label="Salary changes · 90d"
      value="318"
      delta="+8.4%"
      deltaTone="positive"
      note="median raise"
      trend={[22, 18, 31, 26, 64, 41, 38, 46, 32]}
    />
    <StatTile
      label="Rows with problems"
      value="19"
      delta="−3"
      deltaTone="negative"
      note="since last upload"
    />
  </div>
);
