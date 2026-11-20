import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResource } from './useResource';

describe('useResource', () => {
  it('loads, then reports the data', async () => {
    const { result } = renderHook(() => useResource('employees', async () => ['Asha']));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toEqual(['Asha']);
  });

  it('reports an error and loads again on reload', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useResource('meta', load));

    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('ok');
  });

  it('does not load while the key is null', () => {
    const load = vi.fn();
    const { result } = renderHook(() => useResource(null, load));

    expect(result.current.status).toBe('idle');
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the previous data while the next key loads', async () => {
    const { result, rerender } = renderHook(
      ({ page }) => useResource(`page-${page}`, async () => page),
      {
        initialProps: { page: 1 },
      },
    );
    await waitFor(() => expect(result.current.data).toBe(1));

    rerender({ page: 2 });

    expect(result.current.status).toBe('loading');
    expect(result.current.previous).toBe(1);
  });

  it('keeps showing the data while the same key reloads', async () => {
    let calls = 0;
    const { result } = renderHook(() => useResource('roles', async () => ++calls));
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => result.current.reload());

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe(1);
    expect(result.current.refreshing).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(result.current.refreshing).toBe(false);
  });
});
