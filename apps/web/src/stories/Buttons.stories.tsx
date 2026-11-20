import type { Story } from '@ladle/react';
import { IconDownload, IconPlus } from '@tabler/icons-react';
import { PillButton } from '../components';
import { row } from './layout';

export default { title: 'Atoms / Pill button' };

export const Tones: Story = () => (
  <div style={row}>
    <PillButton tone="primary">Primary</PillButton>
    <PillButton>Secondary</PillButton>
    <PillButton tone="quiet">Quiet</PillButton>
    <PillButton tone="danger">Terminate</PillButton>
  </div>
);

export const States: Story = () => (
  <div style={row}>
    <PillButton tone="primary" loading>
      Saving
    </PillButton>
    <PillButton disabled>Disabled</PillButton>
    <PillButton size="small">Small</PillButton>
  </div>
);

export const WithIcons: Story = () => (
  <div style={row}>
    <PillButton icon={<IconDownload size={16} />}>Export CSV</PillButton>
    <PillButton tone="primary" icon={<IconPlus size={16} />}>
      Add employee
    </PillButton>
  </div>
);
