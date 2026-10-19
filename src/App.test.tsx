import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { mockApi } from './test/mockApi';
import { renderApp } from './test/render';

const emptyDashboard = {
  from: '2026-10',
  to: '2026-10',
  kpis: {
    net_worth_cents: 0,
    month_expenses_cents: 0,
    invested_cents: 0,
    investments_value_cents: 0,
    total_debt_cents: 0,
  },
  net_worth: [
    { month: '2026-10', accounts_cents: 0, investments_cents: 0, debts_cents: 0, net_worth_cents: 0 },
  ],
  cashflow: [{ month: '2026-10', income_cents: 0, expense_cents: 0, balance_cents: 0 }],
  spending_by_category: [],
  debts: [],
  investments: [{ month: '2026-10', invested_cents: 0, current_cents: 0 }],
  goals: [],
};

function mockEmptyBackend() {
  return mockApi({
    'GET /api/dashboard': emptyDashboard,
    'GET /api/accounts': [],
    'GET /api/categories': [],
    'GET /api/transactions': [],
    'GET /api/investments': [],
    'GET /api/goals': [],
    'GET /api/debts': [],
  });
}

describe('App', () => {
  it.each([
    ['/', 'Comece pelo primeiro cadastro'],
    ['/transacoes', 'Cadastre sua primeira conta'],
    ['/investimentos', 'Cadastre seu primeiro investimento'],
    ['/metas', 'Cadastre sua primeira meta'],
    ['/dividas', 'Cadastre sua primeira dívida'],
  ])('shows the empty state with a first-registration call to action on %s', async (route, heading) => {
    mockEmptyBackend();
    renderApp(<App />, route);
    expect(await screen.findByRole('heading', { name: heading }, { timeout: 8000 })).toBeInTheDocument();
  });

  it('reloads the empty dashboard after a launch saved from the floating button (L2)', async () => {
    const api = mockApi({
      'GET /api/dashboard': emptyDashboard,
      'GET /api/accounts': [{ id: 1, name: 'Nubank', type: 'checking' }],
      'GET /api/categories': [{ id: 2, name: 'Alimentação' }],
      'GET /api/transactions': [],
      'GET /api/investments': [],
      'GET /api/goals': [],
      'GET /api/debts': [],
      'POST /api/transactions': { status: 201, body: { id: 10 } },
    });
    renderApp(<App />);
    await screen.findByRole('heading', { name: 'Comece pelo primeiro cadastro' });
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar lançamento rápido' }));
    await userEvent.type(screen.getByLabelText('Valor do lançamento'), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Alimentação' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar lançamento' }));

    await waitFor(() => expect(api.called('POST', '/api/transactions')).toHaveLength(1));
    await waitFor(() => expect(api.called('GET', '/api/dashboard')).toHaveLength(2));
  });

  it('navigates between pages', async () => {
    mockEmptyBackend();
    renderApp(<App />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Painel', 'Metas', 'Transações']);

    await userEvent.click(within(nav).getByRole('link', { name: 'Metas' }));
    expect(await screen.findByRole('heading', { name: 'Metas', level: 1 })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Metas' })).toHaveClass('active');

    await userEvent.click(within(nav).getByRole('link', { name: 'Transações' }));
    expect(await screen.findByRole('heading', { name: 'Transações', level: 1 })).toBeInTheDocument();
  });

  it('reaches the import page from the link on Transações, without it being in the main nav', async () => {
    mockEmptyBackend();
    renderApp(<App />, '/transacoes');
    await screen.findByRole('heading', { name: 'Transações', level: 1 });

    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).queryByRole('link', { name: /importar/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Importar extrato →' }));
    expect(await screen.findByRole('heading', { name: 'Importar extrato', level: 1 })).toBeInTheDocument();
  });

  it('links the empty dashboard to the registration screens', async () => {
    mockEmptyBackend();
    renderApp(<App />);
    await userEvent.click(await screen.findByRole('link', { name: 'Cadastrar conta e transações' }));
    expect(await screen.findByRole('heading', { name: 'Transações', level: 1 })).toBeInTheDocument();
  });

  it('shows a not found page for unknown routes', async () => {
    mockEmptyBackend();
    renderApp(<App />, '/nada');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Ir para o Painel' }));
    expect(await screen.findByRole('heading', { name: 'Painel', level: 1 })).toBeInTheDocument();
  });

  it('toggles the theme and keeps it after remounting', async () => {
    mockEmptyBackend();
    const first = renderApp(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Mudar para o tema escuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Mudar para o tema claro' })).toHaveTextContent('Tema claro');

    first.unmount();
    document.documentElement.removeAttribute('data-theme');
    renderApp(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Mudar para o tema claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('finance-theme')).toBe('light');
  });

  it('opens quick capture modal when clicking FAB or pressing N key', async () => {
    mockEmptyBackend();
    renderApp(<App />);
    const fab = screen.getByRole('button', { name: 'Adicionar lançamento rápido' });
    expect(fab).toBeInTheDocument();

    await userEvent.click(fab);
    expect(await screen.findByRole('dialog', { name: 'Nova Despesa' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('n');
    expect(await screen.findByRole('dialog', { name: 'Nova Despesa' })).toBeInTheDocument();
  });
});
