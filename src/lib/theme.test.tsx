import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { stubSystemTheme } from '../test/setup';
import { ThemeProvider, useTheme } from './theme';

function Probe() {
  const { theme, toggle } = useTheme();
  return <button onClick={toggle}>tema:{theme}</button>;
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  it('follows the system theme when nothing is stored', () => {
    stubSystemTheme(true);
    renderProbe();
    expect(screen.getByRole('button')).toHaveTextContent('tema:dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses the stored preference over the system theme', () => {
    stubSystemTheme(true);
    localStorage.setItem('finance-theme', 'light');
    renderProbe();
    expect(screen.getByRole('button')).toHaveTextContent('tema:light');
  });

  it('toggles the theme and persists it across a reload', async () => {
    renderProbe();
    expect(screen.getByRole('button')).toHaveTextContent('tema:light');

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('tema:dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('finance-theme')).toBe('dark');

    renderProbe();
    expect(screen.getAllByRole('button')[1]).toHaveTextContent('tema:dark');
  });

  it('tracks system changes until the user picks a theme', async () => {
    const system = stubSystemTheme(false);
    renderProbe();
    act(() => system.change(true));
    expect(screen.getByRole('button')).toHaveTextContent('tema:dark');

    await userEvent.click(screen.getByRole('button'));
    act(() => system.change(true));
    expect(screen.getByRole('button')).toHaveTextContent('tema:light');
  });

  it('works when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderProbe();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('tema:dark');
  });

  it('falls back to light when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);
    renderProbe();
    expect(screen.getByRole('button')).toHaveTextContent('tema:light');
  });
});
