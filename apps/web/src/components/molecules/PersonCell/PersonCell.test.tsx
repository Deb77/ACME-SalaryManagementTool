import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { initialsOf } from './PersonCell.utils';
import { PersonCell } from './PersonCell';

describe('PersonCell', () => {
  it('links the name to the person when given a destination', () => {
    render(<PersonCell name="Priya Sharma" detail="ACME-00042" href="/employees/42" />);

    expect(screen.getByRole('link', { name: 'Priya Sharma' })).toHaveAttribute(
      'href',
      '/employees/42',
    );
    expect(screen.getByText('ACME-00042')).toBeInTheDocument();
  });

  it('hides the initials avatar from assistive technology', () => {
    render(<PersonCell name="Priya Sharma" />);

    expect(screen.getByText('PS').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('initialsOf', () => {
  it('takes the first and last word', () => {
    expect(initialsOf('  Ana  de la Cruz ')).toBe('AC');
  });

  it('handles single names and blanks', () => {
    expect(initialsOf('Madonna')).toBe('MA');
    expect(initialsOf('   ')).toBe('?');
  });

  it('uses letters only, skipping punctuation and parenthesised notes', () => {
    expect(initialsOf('Global HR (demo)')).toBe('GH');
    expect(initialsOf("Seán O'Neil-Smith")).toBe('SO');
    expect(initialsOf('(demo)')).toBe('DE');
    expect(initialsOf('Agent 007')).toBe('AG');
    expect(initialsOf('123 !!')).toBe('?');
  });
});
