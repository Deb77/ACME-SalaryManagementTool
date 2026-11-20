import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';

describe('FormField', () => {
  it('labels the control and describes it with the hint', () => {
    render(
      <FormField label="Work email" hint="We send sign-in links here">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Work email');
    expect(input).toHaveAccessibleDescription('We send sign-in links here');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and describes it with the error', () => {
    render(
      <FormField label="Work email" hint="hint" error="Already used by ACME-04217">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Work email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Already used by ACME-04217');
  });

  it('marks optional fields in the label', () => {
    render(
      <FormField label="Note" optional>
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByLabelText(/Note\s+\(optional\)/)).toBeInTheDocument();
  });
});
