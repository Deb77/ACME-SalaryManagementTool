import type { Story } from '@ladle/react';
import { EmployeeFormSkeleton } from '../../screens/EmployeeForm/EmployeeFormSkeleton';
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
AddEmployeeCountryHr.storyName = 'Add employee, Country HR (one country, before choosing a role)';
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

export const LoadingAdd: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <EmployeeFormSkeleton mode="add" />
  </ScreenFrame>
);
LoadingAdd.storyName = 'Loading, add';
LoadingAdd.meta = { fullscreen: true };

export const LoadingAddCountryHr: Story = () => (
  <ScreenFrame me={sampleMeCountry} path="/employees">
    <EmployeeFormSkeleton mode="add" oneCountry />
  </ScreenFrame>
);
LoadingAddCountryHr.storyName = 'Loading, add, Country HR';
LoadingAddCountryHr.meta = { fullscreen: true };

export const LoadingEdit: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/employees">
    <EmployeeFormSkeleton mode="edit" />
  </ScreenFrame>
);
LoadingEdit.storyName = 'Loading, edit';
LoadingEdit.meta = { fullscreen: true };
