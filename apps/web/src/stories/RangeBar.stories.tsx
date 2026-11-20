import type { Story } from '@ladle/react';
import { RangeBar } from '../components';

export default { title: 'Atoms / Range bar' };

const column = { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 } as const;

export const Basic: Story = () => (
  <div style={column}>
    <RangeBar label="Range 20 to 60, median 35" min={20} median={35} max={60} />
    <RangeBar
      label="Range 20 to 60, median 35, on a 0 to 100 scale"
      min={20}
      median={35}
      max={60}
      scaleMin={0}
      scaleMax={100}
    />
  </div>
);

export const WithMarker: Story = () => (
  <div style={column}>
    <RangeBar
      label="Range 20 to 60, median 35, marker at 50"
      min={20}
      median={35}
      max={60}
      marker={50}
      scaleMin={0}
      scaleMax={100}
    />
  </div>
);
