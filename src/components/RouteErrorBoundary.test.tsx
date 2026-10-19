import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary';

const BrokenChunk = lazy(() =>
  Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/old.js')),
);

describe('RouteErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an error with a reload button when a lazy page fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    render(
      <RouteErrorBoundary onReload={reload}>
        <Suspense fallback={<p>Carregando…</p>}>
          <BrokenChunk />
        </Suspense>
      </RouteErrorBoundary>,
    );
    expect(await screen.findByText('Não foi possível carregar esta tela.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders the page when nothing fails', () => {
    render(
      <RouteErrorBoundary>
        <p>Painel</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('Painel')).toBeInTheDocument();
  });
});
