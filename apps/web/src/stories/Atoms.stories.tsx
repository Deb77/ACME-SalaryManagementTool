import type { Story } from '@ladle/react';
import { IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import { AppLink, IconButton, MeterBar } from '../components';
import { row } from './layout';

export default { title: 'Atoms / Links and icon buttons' };

export const Links: Story = () => (
  <div style={row}>
    <AppLink href="#employees">Employees</AppLink>
    <AppLink href="#detail">Priya Sharma</AppLink>
  </div>
);
Links.storyName = 'App link';

export const IconButtons: Story = () => (
  <div style={row}>
    <IconButton label="Edit role" icon={<IconPencil size={18} />} />
    <IconButton label="Delete role" icon={<IconTrash size={18} />} />
    <IconButton label="More actions" tone="filled" icon={<IconDotsVertical size={18} />} />
    <IconButton label="Open detail" href="#detail" icon={<IconPencil size={18} />} />
    <IconButton label="Not allowed" disabled icon={<IconTrash size={18} />} />
  </div>
);
IconButtons.storyName = 'Icon button';

export const Meters: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
    <MeterBar value={2140} max={2140} />
    <MeterBar value={1320} max={2140} />
    <MeterBar value={180} max={2140} />
    <MeterBar value={0} max={2140} />
  </div>
);
Meters.storyName = 'Meter bar';
