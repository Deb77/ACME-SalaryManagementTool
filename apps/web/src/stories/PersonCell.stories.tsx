import type { Story } from '@ladle/react';
import { PersonCell } from '../components';
import { row } from './layout';

export default { title: 'Molecules / Person cell' };

export const People: Story = () => (
  <div style={row}>
    <PersonCell
      name="Priya Sharma"
      detail="ACME-00042 · Senior Software Engineer · India"
      size="large"
    />
    <PersonCell name="Arjun Mehta" detail="arjun.mehta@acme.com" href="#" />
  </div>
);
