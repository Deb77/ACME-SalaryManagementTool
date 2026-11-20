import type { Story } from '@ladle/react';
import {
  EmployeeFormView,
  type EmployeeFormViewProps,
} from '../../screens/EmployeeForm/EmployeeFormView';
import { sampleMeCountry, sampleMeGlobal, sampleMeta, samplePriya } from '../screenSampleData';
import { ScreenFrame } from './ScreenFrame';

export default { title: 'Screens / Employee form' };

const base: EmployeeFormViewProps = {
  countries: sampleMeta.countries,
  departments: sampleMeta.departments,
  jobTitles: sampleMeta.jobTitles,
  benchmark: {
    jobTitle: 'Senior Software Engineer',
    countryName: 'India',
    currency: 'INR',
    headcount: 214,
    minMinor: 240_000_000,
    medianMinor: 330_000_000,
    maxMinor: 460_000_000,
  },
  cancelHref: '/employees',
  onSubmit: () => {},
};

export const AddEmployee: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <EmployeeFormView {...base} />
  </ScreenFrame>
);
AddEmployee.meta = { fullscreen: true };

export const AddEmployeeCountryHr: Story = () => (
  <ScreenFrame me={sampleMeCountry} path="/employees">
    <EmployeeFormView
      {...base}
      countries={sampleMeta.countries.filter((c) => c.code === 'IN')}
      benchmark={null}
    />
  </ScreenFrame>
);
AddEmployeeCountryHr.storyName = 'Add employee, Country HR (one country, no benchmark)';
AddEmployeeCountryHr.meta = { fullscreen: true };

export const EditDetails: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <EmployeeFormView {...base} employee={samplePriya} />
  </ScreenFrame>
);
EditDetails.meta = { fullscreen: true };

export const ServerErrors: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <EmployeeFormView
      {...base}
      error="Check the highlighted fields."
      serverErrors={{ email: 'Another employee already uses this email.' }}
    />
  </ScreenFrame>
);
ServerErrors.storyName = 'Server errors';
ServerErrors.meta = { fullscreen: true };
