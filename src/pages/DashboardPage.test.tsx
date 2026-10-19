import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { paletteFor } from '../lib/palette';
import { apiError, mockApi, type MockRequest } from '../test/mockApi';
import { renderApp } from '../test/render';
import type { Dashboard } from '../types';
import DashboardPage, { isDashboardEmpty } from './DashboardPage';

function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    from: '2026-09',
    to: '2026-10',
    kpis: {
      net_worth_cents: 510000,
      month_expenses_cents: 10000,
      invested_cents: 100000,
      investments_value_cents: 120000,
      total_debt_cents: 75000,
    },
    net_worth: [
      {
        month: '2026-09',
        accounts_cents: 475000,
        investments_cents: 100000,
        debts_cents: 75000,
        net_worth_cents: 500000,
      },
      {
        month: '2026-10',
        accounts_cents: 465000,
        investments_cents: 120000,
        debts_cents: 75000,
        net_worth_cents: 510000,
      },
    ],
    cashflow: [
      { month: '2026-09', income_cents: 500000, expense_cents: 25000, balance_cents: 475000 },
      { month: '2026-10', income_cents: 0, expense_cents: 10000, balance_cents: -10000 },
    ],
    spending_by_category: [
      { month: '2026-09', category_id: 2, category: 'Alimentação', amount_cents: 20000 },
      { month: '2026-09', category_id: 3, category: 'Transporte', amount_cents: 5000 },
      { month: '2026-10', category_id: 2, category: 'Alimentação', amount_cents: 10000 },
    ],
    debts: [
      {
        id: 1,
        name: 'Empréstimo',
        balance_cents: 75000,
        never_pays_off: false,
        not_started: false,
        payoff_month: '2027-01',
        history: [
          { month: '2026-09', balance_cents: 75000 },
          { month: '2026-10', balance_cents: 75000 },
        ],
        projection: [
          { month: '2026-11', balance_cents: 50000 },
          { month: '2026-12', balance_cents: 25000 },
          { month: '2027-01', balance_cents: 0 },
        ],
      },
      {
        id: 2,
        name: 'Rotativo',
        balance_cents: 1000,
        never_pays_off: true,
        not_started: false,
        history: [],
        projection: [],
      },
    ],
    investments: [
      { month: '2026-09', invested_cents: 100000, current_cents: 100000 },
      { month: '2026-10', invested_cents: 100000, current_cents: 120000 },
    ],
    goals: [
      {
        id: 1,
        name: 'Viagem',
        target_cents: 100000,
        series: [
          { month: '2026-09', saved_cents: 30000, ideal_cents: 24000 },
          { month: '2026-10', saved_cents: 30000, ideal_cents: 48000 },
        ],
      },
      {
        id: 2,
        name: 'Reserva',
        target_cents: 50000,
        series: [
          { month: '2026-09', saved_cents: 1000, ideal_cents: 2000 },
          { month: '2026-10', saved_cents: 2000, ideal_cents: 4000 },
        ],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 2, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DashboardPage', () => {
  it('requests the last 12 months by default', async () => {
    const api = mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    await screen.findByRole('region', { name: 'Patrimônio líquido' });
    expect(api.called('GET', '/api/dashboard')[0]?.url).toBe('/api/dashboard?from=2025-11&to=2026-10');
    expect(screen.getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the KPI cards formatted as R$ 1.234,56', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const networth = await screen.findByRole('region', { name: 'Patrimônio líquido' });
    expect(within(networth).getByText('R$ 5.100,00')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Gasto do mês' })).getByText('R$ 100,00'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Total investido' })).getByText('R$ 1.000,00'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Dívida total' })).getByText('R$ 750,00'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tendência: Patrimônio líquido' })).toBeInTheDocument();
  });

  it('renders the six charts once "Mais gráficos" is opened', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    await screen.findByRole('region', { name: 'Evolução do patrimônio líquido' });
    await userEvent.click(screen.getByText('Mais gráficos'));
    const titles = [
      'Evolução do patrimônio líquido',
      'Entradas e saídas por mês',
      'Gastos por categoria',
      'Saldo devedor e projeção',
      'Investimentos: aportado e valor atual',
      'Metas: acumulado e ritmo ideal',
    ];
    for (const title of titles) {
      const card = screen.getByRole('region', { name: title });
      expect(card.querySelector('svg.recharts-surface')).not.toBeNull();
    }
    expect(screen.getByText(/Sem previsão de quitação.*Rotativo/)).toBeInTheDocument();
  });

  it('refetches every chart when the period changes', async () => {
    const api = mockApi({
      'GET /api/dashboard': (request: MockRequest) =>
        request.url.includes('from=2026-08')
          ? dashboard({ kpis: { ...dashboard().kpis, net_worth_cents: 999900 } })
          : dashboard(),
    });
    renderApp(<DashboardPage />);
    await screen.findByText('R$ 5.100,00');

    await userEvent.click(screen.getByRole('button', { name: '3 meses' }));
    expect(await screen.findByText('R$ 9.999,00')).toBeInTheDocument();
    expect(api.called('GET', '/api/dashboard').map((c) => c.url)).toEqual([
      '/api/dashboard?from=2025-11&to=2026-10',
      '/api/dashboard?from=2026-08&to=2026-10',
    ]);
    expect(screen.getByRole('button', { name: '3 meses' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: '6 meses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tudo' }));
    await waitFor(() => expect(api.called('GET', '/api/dashboard')).toHaveLength(4));
    expect(
      api
        .called('GET', '/api/dashboard')
        .map((c) => c.url)
        .slice(2),
    ).toEqual(['/api/dashboard?from=2026-05&to=2026-10', '/api/dashboard?to=2026-10']);
  });

  it('shows the empty state when there is no data', async () => {
    mockApi({
      'GET /api/dashboard': dashboard({
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
        goals: [],
        investments: [{ month: '2026-10', invested_cents: 0, current_cents: 0 }],
      }),
    });
    renderApp(<DashboardPage />);
    expect(await screen.findByRole('heading', { name: 'Comece pelo primeiro cadastro' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar conta e transações' })).toHaveAttribute(
      'href',
      '/transacoes',
    );
  });

  it('shows per-chart empty messages when only some data exists', async () => {
    mockApi({
      'GET /api/dashboard': dashboard({
        spending_by_category: [],
        debts: [],
        goals: [],
        investments: [{ month: '2026-10', invested_cents: 0, current_cents: 0 }],
      }),
    });
    renderApp(<DashboardPage />);
    expect(await screen.findByText('Nenhum gasto no período.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma dívida cadastrada.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum investimento no período.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma meta cadastrada.')).toBeInTheDocument();
  });

  it('switches the goal chart between goals', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const select = await screen.findByLabelText('Meta exibida');
    await userEvent.selectOptions(select, '2');
    expect(select).toHaveValue('2');
    await userEvent.selectOptions(select, 'all');
    expect(select).toHaveValue('all');
  });

  it('chooses which debt the debt chart shows, keeping debts that have not started out of the total', async () => {
    const apartment = {
      id: 3,
      name: 'Apartamento',
      balance_cents: 25000000,
      never_pays_off: false,
      not_started: true,
      payoff_month: '2044-01',
      history: [],
      projection: [{ month: '2027-04', balance_cents: 24900000 }],
    };
    mockApi({ 'GET /api/dashboard': dashboard({ debts: [...dashboard().debts, apartment] }) });
    renderApp(<DashboardPage />);
    const select = await screen.findByLabelText('Dívida exibida');
    expect(select).toHaveValue('all');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todas as dívidas', 'Empréstimo', 'Rotativo', 'Apartamento (a iniciar)']);
    expect(screen.getByText(/Dívidas a iniciar ficam fora do total: Apartamento/)).toBeInTheDocument();

    await userEvent.selectOptions(select, '3');
    expect(select).toHaveValue('3');
    expect(screen.queryByText(/Dívidas a iniciar ficam fora do total/)).toBeNull();
  });

  it('draws the debt projection in the same critical color as the history, told apart by dash only', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const card = await screen.findByRole('region', { name: 'Saldo devedor e projeção' });
    await act(async () => {});
    const curves = [...card.querySelectorAll('path.recharts-line-curve')];
    const projection = curves.find((c) => c.getAttribute('stroke-dasharray') === '6 4');
    const history = curves.find((c) => c !== projection);
    expect(projection).toBeDefined();
    expect(history).toBeDefined();
    expect(history?.getAttribute('stroke-dasharray')).not.toBe('6 4');
    expect(projection?.getAttribute('stroke')).toBe(history?.getAttribute('stroke'));
    expect(projection?.getAttribute('stroke')).toBe(paletteFor('light').debt);
  });

  it('keeps long period names for screen readers and short ones for narrow screens', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    await screen.findByRole('region', { name: 'Patrimônio líquido' });
    for (const [name, short] of [
      ['3 meses', '3m'],
      ['6 meses', '6m'],
      ['12 meses', '12m'],
      ['Tudo', 'Tudo'],
    ]) {
      const button = screen.getByRole('button', { name });
      expect(button.querySelector('.label-short')?.textContent).toBe(short);
    }
  });

  it('shows an error with retry when loading fails', async () => {
    let healthy = false;
    mockApi({
      'GET /api/dashboard': () => (healthy ? dashboard() : apiError(500, 'internal', 'Falha ao carregar')),
    });
    renderApp(<DashboardPage />);
    expect(await screen.findByText('Falha ao carregar')).toBeInTheDocument();
    healthy = true;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('R$ 5.100,00')).toBeInTheDocument();
  });

  it('uses the dark palette in the dark theme', async () => {
    localStorage.setItem('finance-theme', 'dark');
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const card = await screen.findByRole('region', { name: 'Evolução do patrimônio líquido' });
    await act(async () => {});
    expect(card.querySelector(`[stroke="${paletteFor('dark').netWorth}"]`)).not.toBeNull();
  });

  it('shows the net worth widget with invested and debt totals, open debt count, and links to investments/debts', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const widget = await screen.findByRole('region', { name: 'Patrimônio' });
    expect(within(widget).getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(within(widget).getByText('R$ 750,00')).toBeInTheDocument();
    expect(within(widget).getByText('(2 em aberto)')).toBeInTheDocument();
    expect(within(widget).getByRole('link', { name: 'Ver investimentos →' })).toHaveAttribute(
      'href',
      '/investimentos',
    );
    expect(within(widget).getByRole('link', { name: 'Ver dívidas →' })).toHaveAttribute('href', '/dividas');
  });

  it('excludes not-started and paid-off debts from the open debt count in the net worth widget', async () => {
    const apartment = {
      id: 3,
      name: 'Apartamento',
      balance_cents: 25000000,
      never_pays_off: false,
      not_started: true,
      payoff_month: '2044-01',
      history: [],
      projection: [],
    };
    const paidOff = {
      id: 4,
      name: 'Cartão',
      balance_cents: 0,
      never_pays_off: false,
      not_started: false,
      history: [],
      projection: [],
    };
    mockApi({ 'GET /api/dashboard': dashboard({ debts: [...dashboard().debts, apartment, paidOff] }) });
    renderApp(<DashboardPage />);
    const widget = await screen.findByRole('region', { name: 'Patrimônio' });
    expect(within(widget).getByText('(2 em aberto)')).toBeInTheDocument();
  });

  it('shows the net worth widget empty state with working links when there are no investments or debts', async () => {
    mockApi({
      'GET /api/dashboard': dashboard({
        kpis: { ...dashboard().kpis, invested_cents: 0, total_debt_cents: 0 },
        debts: [],
      }),
    });
    renderApp(<DashboardPage />);
    const widget = await screen.findByRole('region', { name: 'Patrimônio' });
    expect(within(widget).getByText(/Nenhum valor investido nem dívida/)).toBeInTheDocument();
    expect(within(widget).getByRole('link', { name: 'Ver investimentos →' })).toHaveAttribute(
      'href',
      '/investimentos',
    );
    expect(within(widget).getByRole('link', { name: 'Ver dívidas →' })).toHaveAttribute('href', '/dividas');
  });

  it('never claims no investment is registered in the empty state, since a registered investment can still have R$ 0 invested', async () => {
    mockApi({
      'GET /api/dashboard': dashboard({
        kpis: { ...dashboard().kpis, invested_cents: 0, total_debt_cents: 0 },
        debts: [],
        investments: [{ month: '2026-10', invested_cents: 0, current_cents: 80000 }],
      }),
    });
    renderApp(<DashboardPage />);
    const widget = await screen.findByRole('region', { name: 'Patrimônio' });
    expect(within(widget).queryByText(/Nenhum investimento.*cadastrad/)).toBeNull();
  });

  it('shows the net worth widget empty state when debts exist but none are open (paid off or not started)', async () => {
    const paidOff = {
      id: 1,
      name: 'Cartão',
      balance_cents: 0,
      never_pays_off: false,
      not_started: false,
      history: [],
      projection: [],
    };
    const notStarted = {
      id: 2,
      name: 'Apartamento',
      balance_cents: 30000000,
      never_pays_off: false,
      not_started: true,
      payoff_month: '2044-01',
      history: [],
      projection: [],
    };
    mockApi({
      'GET /api/dashboard': dashboard({
        kpis: { ...dashboard().kpis, invested_cents: 0, total_debt_cents: 0 },
        debts: [paidOff, notStarted],
      }),
    });
    renderApp(<DashboardPage />);
    const widget = await screen.findByRole('region', { name: 'Patrimônio' });
    expect(within(widget).getByText(/Nenhum valor investido nem dívida/)).toBeInTheDocument();
    expect(within(widget).queryByText(/\(\d+ em aberto\)/)).toBeNull();
    expect(within(widget).getByRole('link', { name: 'Ver investimentos →' })).toHaveAttribute(
      'href',
      '/investimentos',
    );
    expect(within(widget).getByRole('link', { name: 'Ver dívidas →' })).toHaveAttribute('href', '/dividas');
  });

  it('renders detailed goals and recent transactions and opens modals on the dashboard', async () => {
    mockApi({
      'GET /api/dashboard': dashboard(),
      'GET /api/goals': [
        {
          id: 1,
          name: 'Viagem Europa',
          target_cents: 1000000,
          saved_cents: 200000,
          progress_pct: 20,
          monthly_needed_cents: 80000,
          deadline: '2027-10-01',
          start_date: '2026-10-01',
          remaining_cents: 800000,
          months_left: 10,
          status: 'on_track',
          contributions: [],
        },
      ],
      'GET /api/transactions': [
        {
          id: 1,
          type: 'expense',
          amount_cents: 4500,
          date: '2026-10-02',
          description: 'Café',
          category_id: 1,
          account_id: 1,
        },
      ],
    });
    renderApp(<DashboardPage />);
    expect(await screen.findByText('Viagem Europa')).toBeInTheDocument();
    expect(screen.getByText('Café')).toBeInTheDocument();
    expect(screen.getByText('-R$ 45,00')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar dinheiro na meta Viagem Europa' }));
    expect(await screen.findByRole('dialog', { name: 'Guardar na meta: Viagem Europa' })).toBeInTheDocument();
  });

  it('shows the net worth and cashflow charts without any click (AC-U1)', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const networth = await screen.findByRole('region', { name: 'Evolução do patrimônio líquido' });
    const cashflow = screen.getByRole('region', { name: 'Entradas e saídas por mês' });
    for (const card of [networth, cashflow]) {
      expect(card.closest('details')).toBeNull();
      expect(card.querySelector('svg.recharts-surface')).not.toBeNull();
    }
  });

  it('keeps the other four charts inside a closed "Mais gráficos" disclosure until it is opened (AC-U2)', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const toggle = await screen.findByText('Mais gráficos');
    const disclosure = toggle.closest('details');
    expect(disclosure).not.toBeNull();
    expect(disclosure?.open).toBe(false);
    for (const title of [
      'Gastos por categoria',
      'Saldo devedor e projeção',
      'Investimentos: aportado e valor atual',
      'Metas: acumulado e ritmo ideal',
    ]) {
      expect(screen.getByRole('region', { name: title, hidden: true }).closest('details')).toBe(disclosure);
    }
    await userEvent.click(toggle);
    expect(disclosure?.open).toBe(true);
  });

  it('has no second "+ Lançar" on the dashboard; the floating button is the only launch point (AC-U4)', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<App />);
    await screen.findByRole('region', { name: 'Lançamentos Recentes' });
    expect(screen.getAllByRole('button', { name: /lan[cç]a/i })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Ver extrato completo →' })).toBeInTheDocument();
  });

  it('points the empty recent transactions hint at the floating button (AC-U4)', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    const hint = await screen.findByText(/Nenhum lançamento recente\./);
    expect(hint).toHaveTextContent('Use o botão + Lançar no canto da tela para registrar gastos e receitas.');
  });

  it('labels the chart scope with the selected period and says the top cards ignore the filter (AC-U5)', async () => {
    mockApi({ 'GET /api/dashboard': dashboard() });
    renderApp(<DashboardPage />);
    await screen.findByRole('region', { name: 'Patrimônio líquido' });
    expect(screen.getByText('Gráficos: últimos 12 meses')).toBeInTheDocument();
    expect(
      screen.getByText('Os cartões de topo não mudam com o período; ele vale só para os gráficos.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '3 meses' }));
    expect(await screen.findByText('Gráficos: últimos 3 meses')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tudo' }));
    expect(await screen.findByText('Gráficos: todo o histórico')).toBeInTheDocument();
  });

  it('refreshes the recent transactions and the dashboard when a launch is saved from the floating button', async () => {
    const api = mockApi({ 'GET /api/dashboard': dashboard(), 'GET /api/transactions': [] });
    renderApp(<DashboardPage />);
    await screen.findByRole('region', { name: 'Lançamentos Recentes' });
    await waitFor(() => expect(api.called('GET', '/api/transactions')).toHaveLength(1));

    act(() => {
      window.dispatchEvent(new CustomEvent('finance-reload'));
    });
    await waitFor(() => expect(api.called('GET', '/api/transactions')).toHaveLength(2));
    expect(api.called('GET', '/api/dashboard')).toHaveLength(2);
  });
});

describe('isDashboardEmpty', () => {
  it('is false when there are goals or debts even without balances', () => {
    const base = dashboard({ net_worth: [], cashflow: [] });
    expect(isDashboardEmpty({ ...base, debts: [], goals: [] })).toBe(true);
    expect(isDashboardEmpty({ ...base, goals: [] })).toBe(false);
  });
});
