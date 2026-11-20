import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { hasAcceptedExtension } from './FileDropzone.utils';
import { FileDropzone } from './FileDropzone';

function fileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('file input not rendered');
  return input;
}

describe('FileDropzone', () => {
  it('hands an accepted file to the parent', async () => {
    const onFileSelected = vi.fn();
    const { container } = render(<FileDropzone onFileSelected={onFileSelected} />);
    const file = new File(['code,name'], 'india.csv', { type: 'text/csv' });

    await userEvent.upload(fileInput(container), file);

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('rejects files over the size limit', async () => {
    const onFileSelected = vi.fn();
    const onFileRejected = vi.fn();
    const { container } = render(
      <FileDropzone
        maxSizeBytes={4}
        onFileSelected={onFileSelected}
        onFileRejected={onFileRejected}
      />,
    );
    const file = new File(['too large'], 'india.xlsx');

    await userEvent.upload(fileInput(container), file);

    expect(onFileRejected).toHaveBeenCalledWith(file, 'size');
    expect(onFileSelected).not.toHaveBeenCalled();
  });
});

describe('hasAcceptedExtension', () => {
  it('matches extensions case-insensitively', () => {
    expect(hasAcceptedExtension('Salaries.XLSX', '.xlsx,.csv')).toBe(true);
    expect(hasAcceptedExtension('salaries.pdf', '.xlsx,.csv')).toBe(false);
  });
});

describe('FileDropzone accessibility', () => {
  it('is a keyboard-reachable button that says what it accepts', () => {
    render(<FileDropzone onFileSelected={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /Drop your Excel or CSV file here/ }),
    ).toHaveAttribute('tabindex', '0');
  });
});
