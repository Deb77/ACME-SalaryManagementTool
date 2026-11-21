import type { Story } from '@ladle/react';
import { Stepper } from '../components';

export default { title: 'Molecules / Stepper' };

export const ImportStepper: Story<{ current: number }> = ({ current }) => (
  <Stepper label="Import steps" steps={['Upload', 'Review', 'Import']} current={current} />
);
ImportStepper.args = { current: 1 };
ImportStepper.argTypes = {
  current: { control: { type: 'range', min: 0, max: 2, step: 1 } },
};
