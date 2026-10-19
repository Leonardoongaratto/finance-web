import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '../test/mockApi';
import type { Account, Category } from '../types';
import { QuickCaptureModal } from './QuickCaptureModal';

const accounts: Account[] = [{ id: 1, name: 'Nubank', type: 'checking' }];
const categories: Category[] = [
  { id: 1, name: 'Moradia' },
  { id: 2, name: 'Alimentação' },
];

describe('QuickCaptureModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<QuickCaptureModal isOpen={false} onClose={() => {}} onSaved={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('submits a simple expense with category chip selection', async () => {
    const api = mockApi({
      'POST /api/transactions': { status: 201, body: { id: 10 } },
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <QuickCaptureModal
        isOpen={true}
        onClose={onClose}
        onSaved={onSaved}
        accounts={accounts}
        categories={categories}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Nova Despesa' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Valor do lançamento'), '45');
    // Select category chip 'Alimentação'
    await userEvent.click(screen.getByRole('button', { name: 'Alimentação' }));

    await userEvent.click(screen.getByRole('button', { name: 'Salvar lançamento' }));

    await waitFor(() => expect(api.called('POST', '/api/transactions')).toHaveLength(1));
    expect(api.called('POST', '/api/transactions')[0]?.body).toMatchObject({
      amount_cents: 4500,
      account_id: 1,
      category_id: 2,
      type: 'expense',
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows switching to income and submits correctly', async () => {
    const api = mockApi({
      'POST /api/transactions': { status: 201, body: { id: 11 } },
    });
    render(
      <QuickCaptureModal
        isOpen={true}
        onClose={() => {}}
        onSaved={() => {}}
        accounts={accounts}
        categories={categories}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Receita/ }));
    expect(screen.getByRole('dialog', { name: 'Nova Receita' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Valor do lançamento'), '5000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar lançamento' }));

    await waitFor(() => expect(api.called('POST', '/api/transactions')).toHaveLength(1));
    expect(api.called('POST', '/api/transactions')[0]?.body).toMatchObject({
      amount_cents: 500000,
      type: 'income',
    });
  });
});
