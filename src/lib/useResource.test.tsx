import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResource } from './useResource';

describe('useResource', () => {
  it('starts loading and then exposes the data', async () => {
    const loader = vi.fn().mockResolvedValue('dados');
    const { result } = renderHook(() => useResource(loader));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('dados');
    expect(result.current.error).toBeUndefined();
  });

  it('exposes errors and recovers on reload', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValue('ok');
    const { result } = renderHook(() => useResource(loader));
    await waitFor(() => expect(result.current.error?.message).toBe('falhou'));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeUndefined();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('wraps non-Error rejections', async () => {
    const loader = vi.fn().mockRejectedValue('texto');
    const { result } = renderHook(() => useResource(loader));
    await waitFor(() => expect(result.current.error?.message).toBe('texto'));
  });

  it('reloads when the loader changes and ignores stale results', async () => {
    let resolveFirst: (value: string) => void = () => {};
    const first = () => new Promise<string>((resolve) => (resolveFirst = resolve));
    const second = () => Promise.resolve('segundo');

    const { result, rerender } = renderHook(({ loader }) => useResource(loader), {
      initialProps: { loader: first },
    });
    rerender({ loader: second });
    await waitFor(() => expect(result.current.data).toBe('segundo'));

    resolveFirst('primeiro');
    await Promise.resolve();
    expect(result.current.data).toBe('segundo');
  });
});
