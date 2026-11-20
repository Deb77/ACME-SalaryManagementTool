import type { Story } from '@ladle/react';
import { Stepper } from '../components';

export default { title: 'Molecules / Stepper' };

export const ImportStepper: Story<{ current: number }> = ({ current }) => (
  <Stepper
    label="Import steps"
    steps={['Upload', 'Match columns', 'Review', 'Import']}
    current={current}
  />
);
ImportStepper.args = { current: 2 };
ImportStepper.argTypes = {
  current: { control: { type: 'range', min: 0, max: 3, step: 1 } },
};
