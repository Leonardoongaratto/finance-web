import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp as render } from '../test/render';
import { apiError, mockApi } from '../test/mockApi';
import type { Account, Category, Transaction } from '../types';
import TransactionsPage from './TransactionsPage';

const accounts: Account[] = [{ id: 1, name: 'Nubank', type: 'checking' }];
const categories: Category[] = [
  { id: 1, name: 'Moradia' },
  { id: 2, name: 'Alimentação' },
];

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    type: 'expense',
    amount_cents: 15000,
    date: '2026-10-01',
    account_id: 1,
    category_id: 2,
    description: 'Mercado',
    ...overrides,
  };
}

function baseRoutes(transactions: Transaction[]) {
  return {
    'GET /api/accounts': accounts,
    'GET /api/categories': categories,
    'GET /api/transactions': transactions,
  };
}

describe('TransactionsPage', () => {
  it('shows the empty state with a call to register the first account', async () => {
    mockApi({ 'GET /api/accounts': [], 'GET /api/categories': categories, 'GET /api/transactions': [] });
    render(<TransactionsPage />);
    expect(await screen.findByRole('heading', { name: 'Cadastre sua primeira conta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da conta')).toBeInTheDocument();
  });

  it('creates the first account and reloads', async () => {
    let created = false;
    const api = mockApi({
      'GET /api/accounts': () => (created ? accounts : []),
      'GET /api/categories': categories,
      'GET /api/transactions': [],
      'POST /api/accounts': () => {
        created = true;
        return { status: 201, body: accounts[0] };
      },
    });
    render(<TransactionsPage />);
    await userEvent.type(await screen.findByLabelText('Nome da conta'), 'Nubank');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conta' }));
    expect(
      await screen.findByRole('heading', { name: 'Registre sua primeira transação' }),
    ).toBeInTheDocument();
    expect(api.called('POST', '/api/accounts')[0]?.body).toEqual({ name: 'Nubank', type: 'checking' });
  });

  it('validates the account name inline', async () => {
    mockApi({ 'GET /api/accounts': [], 'GET /api/categories': categories, 'GET /api/transactions': [] });
    render(<TransactionsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar conta' }));
    expect(screen.getByText('Informe o nome da conta.')).toBeInTheDocument();
  });

  it('shows the empty transaction state when only accounts exist', async () => {
    mockApi(baseRoutes([]));
    render(<TransactionsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Registre sua primeira transação' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
  });

  it('lists transactions with formatted values and dates', async () => {
    mockApi(
      baseRoutes([
        tx({}),
        tx({
          id: 2,
          type: 'income',
          amount_cents: 500000,
          description: 'Salário',
          category_id: 1,
          date: '2026-09-05',
        }),
      ]),
    );
    render(<TransactionsPage />);
    const list = await screen.findByRole('list', { name: 'Lançamentos' });
    expect(within(list).getByText('-R$ 150,00')).toBeInTheDocument();
    expect(within(list).getByText('+R$ 5.000,00')).toBeInTheDocument();
    expect(within(list).getByText(/01\/10\/2026/)).toBeInTheDocument();
  });

  it('filters by type', async () => {
    mockApi(
      baseRoutes([tx({}), tx({ id: 2, type: 'income', amount_cents: 500000, description: 'Salário' })]),
    );
    render(<TransactionsPage />);
    await screen.findByRole('list', { name: 'Lançamentos' });
    await userEvent.click(screen.getByRole('button', { name: 'Entradas' }));
    expect(screen.queryByText('Mercado')).toBeNull();
    expect(screen.getByText('Salário')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Saídas' }));
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.queryByText('Salário')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.getByText('Salário')).toBeInTheDocument();
  });

  it('tells when the selected type has no transactions', async () => {
    mockApi(baseRoutes([tx({})]));
    render(<TransactionsPage />);
    await screen.findByRole('list', { name: 'Lançamentos' });
    await userEvent.click(screen.getByRole('button', { name: 'Entradas' }));
    expect(screen.getByText('Nenhum lançamento deste tipo.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Lançamentos' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Saídas' }));
    expect(screen.queryByText('Nenhum lançamento deste tipo.')).toBeNull();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
  });

  it('validates the form inline and does not call the API', async () => {
    const api = mockApi(baseRoutes([]));
    render(<TransactionsPage />);
    await screen.findByLabelText('Valor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar transação' }));
    expect(screen.getByText('Informe um valor válido, como 1.234,56.')).toBeInTheDocument();
    expect(api.called('POST', '/api/transactions')).toHaveLength(0);
  });

  it('creates a transaction in cents', async () => {
    const api = mockApi({ ...baseRoutes([]), 'POST /api/transactions': { status: 201, body: tx({}) } });
    render(<TransactionsPage />);
    await userEvent.type(await screen.findByLabelText('Valor'), '1.234,56');
    await userEvent.type(screen.getByLabelText('Descrição'), 'Mercado');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar transação' }));
    await waitFor(() => expect(api.called('POST', '/api/transactions')).toHaveLength(1));
    expect(api.called('POST', '/api/transactions')[0]?.body).toMatchObject({
      type: 'expense',
      amount_cents: 123456,
      account_id: 1,
      description: 'Mercado',
    });
  });

  it('creates an installment purchase', async () => {
    const api = mockApi({
      ...baseRoutes([]),
      'POST /api/transactions/installments': { status: 201, body: [] },
    });
    render(<TransactionsPage />);
    await userEvent.type(await screen.findByLabelText('Valor'), '100');
    await userEvent.click(screen.getByLabelText('Parcelar'));
    const count = screen.getByLabelText('Número de parcelas');
    await userEvent.clear(count);
    await userEvent.type(count, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar transação' }));
    await waitFor(() => expect(api.called('POST', '/api/transactions/installments')).toHaveLength(1));
    expect(api.called('POST', '/api/transactions/installments')[0]?.body).toMatchObject({
      total_cents: 10000,
      installments: 3,
    });
  });

  it('rejects an invalid number of installments', async () => {
    const api = mockApi(baseRoutes([]));
    render(<TransactionsPage />);
    await userEvent.type(await screen.findByLabelText('Valor'), '100');
    await userEvent.click(screen.getByLabelText('Parcelar'));
    const count = screen.getByLabelText('Número de parcelas');
    await userEvent.clear(count);
    await userEvent.type(count, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar transação' }));
    expect(screen.getByText('Use entre 2 e 48 parcelas.')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('hides installments for income', async () => {
    mockApi(baseRoutes([]));
    render(<TransactionsPage />);
    await screen.findByLabelText('Valor');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'income');
    expect(screen.queryByLabelText('Parcelar')).toBeNull();
  });

  it('shows the API error when saving fails', async () => {
    mockApi({
      ...baseRoutes([]),
      'POST /api/transactions': apiError(400, 'validation_error', 'referenced record does not exist'),
    });
    render(<TransactionsPage />);
    await userEvent.type(await screen.findByLabelText('Valor'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar transação' }));
    expect(await screen.findByText('referenced record does not exist')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting and then deletes', async () => {
    const api = mockApi({ ...baseRoutes([tx({})]), 'DELETE /api/transactions/1': { status: 204 } });
    render(<TransactionsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Mercado' }));
    expect(api.called('DELETE', '/api/transactions/1')).toHaveLength(0);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/transactions/1')).toHaveLength(1));
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const api = mockApi(baseRoutes([tx({})]));
    render(<TransactionsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Mercado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('offers to delete the whole installment group', async () => {
    const api = mockApi({
      ...baseRoutes([tx({ installment_group: 'grp1', description: 'TV 1/3' })]),
      'DELETE /api/installments/grp1': { status: 204 },
    });
    render(<TransactionsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir TV 1/3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir todas as parcelas' }));
    await waitFor(() => expect(api.called('DELETE', '/api/installments/grp1')).toHaveLength(1));
  });

  it('reports failures when deleting', async () => {
    mockApi({
      ...baseRoutes([tx({})]),
      'DELETE /api/transactions/1': apiError(500, 'internal', 'internal error'),
    });
    render(<TransactionsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Mercado' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', async () => {
    let healthy = false;
    mockApi({
      'GET /api/accounts': () => (healthy ? accounts : apiError(500, 'internal', 'Falha ao carregar')),
      'GET /api/categories': categories,
      'GET /api/transactions': [],
    });
    render(<TransactionsPage />);
    expect(await screen.findByText('Falha ao carregar')).toBeInTheDocument();
    healthy = true;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Valor')).toBeInTheDocument();
  });

  it('manages categories and accounts', async () => {
    const api = mockApi({
      ...baseRoutes([]),
      'POST /api/categories': { status: 201, body: { id: 3, name: 'Pets' } },
      'DELETE /api/categories/1': apiError(409, 'conflict', 'resource is in use or already exists'),
      'DELETE /api/accounts/1': { status: 204 },
    });
    render(<TransactionsPage />);
    await userEvent.type(await screen.findByLabelText('Nome da categoria'), 'Pets');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar categoria' }));
    await waitFor(() => expect(api.called('POST', '/api/categories')).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Excluir categoria Moradia' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('resource is in use or already exists')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Excluir conta Nubank' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/accounts/1')).toHaveLength(1));
  });

  it('validates the category name', async () => {
    mockApi(baseRoutes([]));
    render(<TransactionsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar categoria' }));
    expect(screen.getByText('Informe o nome da categoria.')).toBeInTheDocument();
  });

  it('adds another account', async () => {
    const api = mockApi({
      ...baseRoutes([]),
      'POST /api/accounts': { status: 201, body: { id: 2, name: 'Carteira', type: 'cash' } },
    });
    render(<TransactionsPage />);
    await userEvent.type(await screen.findByLabelText('Nome da conta'), 'Carteira');
    await userEvent.selectOptions(screen.getByLabelText('Tipo de conta'), 'cash');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conta' }));
    await waitFor(() =>
      expect(api.called('POST', '/api/accounts')[0]?.body).toEqual({ name: 'Carteira', type: 'cash' }),
    );
  });
});
