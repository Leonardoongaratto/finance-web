import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, mockApi } from '../test/mockApi';
import type { Debt } from '../types';
import DebtsPage from './DebtsPage';

const loan: Debt = {
  id: 1,
  name: 'Empréstimo',
  creditor: 'Banco X',
  original_cents: 1000000,
  monthly_rate_bp: 150,
  monthly_payment_cents: 250000,
  start_date: '2026-10-01',
  payments: [{ id: 9, date: '2026-10-05', amount_cents: 250000 }],
  balance_cents: 750000,
  paid_off: false,
  never_pays_off: false,
  payoff_month: '2027-02',
  payoff_months: 4,
  not_started: false,
};

describe('DebtsPage', () => {
  it('shows the empty state with a call to register the first debt', async () => {
    mockApi({ 'GET /api/debts': [] });
    render(<DebtsPage />);
    expect(await screen.findByRole('heading', { name: 'Cadastre sua primeira dívida' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da dívida')).toBeInTheDocument();
  });

  it('creates a debt converting the rate to basis points', async () => {
    const api = mockApi({ 'GET /api/debts': [], 'POST /api/debts': { status: 201, body: loan } });
    render(<DebtsPage />);
    await userEvent.type(await screen.findByLabelText('Nome da dívida'), 'Cartão');
    await userEvent.type(screen.getByLabelText('Credor'), 'Banco');
    await userEvent.type(screen.getByLabelText('Valor original'), '10.000');
    await userEvent.type(screen.getByLabelText('Juros ao mês (%)'), '1,5');
    await userEvent.type(screen.getByLabelText('Parcela mensal'), '2.500');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dívida' }));
    await waitFor(() => expect(api.called('POST', '/api/debts')).toHaveLength(1));
    expect(api.called('POST', '/api/debts')[0]?.body).toMatchObject({
      name: 'Cartão',
      creditor: 'Banco',
      original_cents: 1000000,
      monthly_rate_bp: 150,
      monthly_payment_cents: 250000,
    });
  });

  it('accepts a debt without interest or monthly payment', async () => {
    const api = mockApi({ 'GET /api/debts': [], 'POST /api/debts': { status: 201, body: loan } });
    render(<DebtsPage />);
    await userEvent.type(await screen.findByLabelText('Nome da dívida'), 'Amigo');
    await userEvent.type(screen.getByLabelText('Valor original'), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dívida' }));
    await waitFor(() => expect(api.called('POST', '/api/debts')).toHaveLength(1));
    expect(api.called('POST', '/api/debts')[0]?.body).toMatchObject({
      monthly_rate_bp: 0,
      monthly_payment_cents: 0,
    });
  });

  it('validates the debt form inline', async () => {
    const api = mockApi({ 'GET /api/debts': [] });
    render(<DebtsPage />);
    await userEvent.type(await screen.findByLabelText('Juros ao mês (%)'), '500');
    await userEvent.type(screen.getByLabelText('Parcela mensal'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dívida' }));
    expect(screen.getByText('Informe o nome da dívida.')).toBeInTheDocument();
    expect(screen.getAllByText('Informe um valor válido, como 1.234,56.')).toHaveLength(2);
    expect(screen.getByText('Informe uma taxa entre 0 e 100, como 1,5.')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('shows balance, rate and the payoff projection', async () => {
    mockApi({ 'GET /api/debts': [loan] });
    render(<DebtsPage />);
    const card = await screen.findByRole('region', { name: 'Empréstimo' });
    expect(within(card).getByText('R$ 7.500,00')).toBeInTheDocument();
    expect(within(card).getByText('1,5% ao mês')).toBeInTheDocument();
    expect(within(card).getByText('Quita em fev/27 (4 meses)')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Resumo' });
    expect(within(summary).getByText('R$ 7.500,00')).toBeInTheDocument();
  });

  it('marks debts that have not started and keeps them out of the total, like the dashboard', async () => {
    const financing: Debt = {
      ...loan,
      id: 2,
      name: 'Financiamento',
      start_date: '2027-03-01',
      payments: [],
      balance_cents: 5000000,
      not_started: true,
      payoff_month: '2033-01',
      payoff_months: 75,
    };
    mockApi({ 'GET /api/debts': [loan, financing] });
    render(<DebtsPage />);
    const card = await screen.findByRole('region', { name: 'Financiamento' });
    expect(within(card).getByText('Começa em mar/27')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Empréstimo' })).queryByText(/Começa em/)).toBeNull();
    const summary = screen.getByRole('region', { name: 'Resumo' });
    expect(within(summary).getByText('R$ 7.500,00')).toBeInTheDocument();
    expect(within(summary).getByText('A iniciar')).toBeInTheDocument();
    expect(within(summary).getByText('R$ 50.000,00')).toBeInTheDocument();
  });

  it('excludes not-started debts from "Dívidas em aberto", matching the dashboard widget', async () => {
    const financing: Debt = {
      ...loan,
      id: 2,
      name: 'Financiamento',
      start_date: '2027-03-01',
      payments: [],
      balance_cents: 5000000,
      not_started: true,
      payoff_month: '2033-01',
      payoff_months: 75,
    };
    mockApi({ 'GET /api/debts': [loan, financing] });
    render(<DebtsPage />);
    await screen.findByRole('region', { name: 'Financiamento' });
    const summary = screen.getByRole('region', { name: 'Resumo' });
    expect(within(summary).getByText('Dívidas em aberto')).toBeInTheDocument();
    expect(within(summary).getByText('1')).toBeInTheDocument();
  });

  it('shows the never-pays-off warning', async () => {
    mockApi({
      'GET /api/debts': [{ ...loan, never_pays_off: true, payoff_month: undefined, payoff_months: 0 }],
    });
    render(<DebtsPage />);
    expect(await screen.findByText(/Nunca quita/)).toBeInTheDocument();
  });

  it('shows paid off debts', async () => {
    mockApi({
      'GET /api/debts': [
        { ...loan, paid_off: true, balance_cents: 0, payoff_months: 0, payoff_month: undefined },
      ],
    });
    render(<DebtsPage />);
    expect(await screen.findByText('Quitada')).toBeInTheDocument();
  });

  it('uses the singular for one remaining month', async () => {
    mockApi({ 'GET /api/debts': [{ ...loan, payoff_months: 1, payoff_month: '2026-11' }] });
    render(<DebtsPage />);
    expect(await screen.findByText('Quita em nov/26 (1 mês)')).toBeInTheDocument();
  });

  it('registers a payment from the "+ Pagamento" modal', async () => {
    const api = mockApi({
      'GET /api/debts': [loan],
      'POST /api/debts/1/payments': { status: 201, body: {} },
    });
    render(<DebtsPage />);
    const card = await screen.findByRole('region', { name: 'Empréstimo' });
    await userEvent.click(within(card).getByRole('button', { name: '+ Pagamento' }));
    const dialog = screen.getByRole('dialog', { name: 'Pagamento: Empréstimo' });
    await userEvent.type(within(dialog).getByLabelText('Valor do pagamento'), '2.500,00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pagamento' }));
    await waitFor(() => expect(api.called('POST', '/api/debts/1/payments')).toHaveLength(1));
    expect(api.called('POST', '/api/debts/1/payments')[0]?.body).toMatchObject({ amount_cents: 250000 });
  });

  it('deletes a payment and a debt after confirmation', async () => {
    const api = mockApi({
      'GET /api/debts': [loan],
      'DELETE /api/debts/1/payments/9': { status: 204 },
      'DELETE /api/debts/1': { status: 204 },
    });
    render(<DebtsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir pagamento de 05/10/2026' }));
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/debts/1/payments/9')).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Excluir dívida Empréstimo' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/debts/1')).toHaveLength(1));
  });

  it('shows failures when deleting', async () => {
    mockApi({ 'GET /api/debts': [loan], 'DELETE /api/debts/1': apiError(500, 'internal', 'internal error') });
    render(<DebtsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir dívida Empréstimo' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    mockApi({ 'GET /api/debts': apiError(500, 'internal', 'Falha ao carregar') });
    render(<DebtsPage />);
    expect(await screen.findByText('Falha ao carregar')).toBeInTheDocument();
  });

  it('hides the new-debt form once debts exist and opens it from a "+ Nova dívida" button (AC-U6)', async () => {
    mockApi({ 'GET /api/debts': [loan] });
    render(<DebtsPage />);
    await screen.findByRole('region', { name: 'Empréstimo' });
    expect(screen.queryByLabelText('Nome da dívida')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: '+ Nova dívida' }));
    const dialog = screen.getByRole('dialog', { name: 'Nova dívida' });
    expect(within(dialog).getByLabelText('Nome da dívida')).toBeInTheDocument();
  });

  it('saves a new debt from the modal, closes it and lists the debt (AC-U7)', async () => {
    const created: Debt = { ...loan, id: 2, name: 'Cartão' };
    let debts: Debt[] = [loan];
    const api = mockApi({
      'GET /api/debts': () => debts,
      'POST /api/debts': () => {
        debts = [loan, created];
        return { status: 201, body: created };
      },
    });
    render(<DebtsPage />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Nova dívida' }));
    const dialog = screen.getByRole('dialog', { name: 'Nova dívida' });
    await userEvent.type(within(dialog).getByLabelText('Nome da dívida'), 'Cartão');
    await userEvent.type(within(dialog).getByLabelText('Valor original'), '300');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar dívida' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.called('POST', '/api/debts')).toHaveLength(1);
    expect(await screen.findByRole('region', { name: 'Cartão' })).toBeInTheDocument();
  });

  it('keeps the modal open with the inline validation error and saves nothing for an invalid debt (AC-U7)', async () => {
    const api = mockApi({ 'GET /api/debts': [loan] });
    render(<DebtsPage />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Nova dívida' }));
    const dialog = screen.getByRole('dialog', { name: 'Nova dívida' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar dívida' }));
    expect(within(dialog).getByText('Informe o nome da dívida.')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Nova dívida' })).toBeInTheDocument();
  });

  it('shows only the 5 most recent payments with "Ver todos" for the rest, and no payment form open (AC-U8)', async () => {
    const payments = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      date: `2026-10-0${i + 1}`,
      amount_cents: 1000 * (i + 1),
    }));
    mockApi({ 'GET /api/debts': [{ ...loan, payments }] });
    render(<DebtsPage />);
    const card = await screen.findByRole('region', { name: 'Empréstimo' });
    const list = within(card).getByRole('list', { name: 'Pagamentos' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(card).queryByRole('button', { name: 'Excluir pagamento de 01/10/2026' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Ver todos (7)' })).toBeInTheDocument();
    expect(within(card).queryByLabelText('Valor do pagamento')).toBeNull();
  });

  it('shows the new payment in the card and updates the balance after the modal saves it (AC-U9)', async () => {
    let current: Debt = loan;
    const api = mockApi({
      'GET /api/debts': () => [current],
      'POST /api/debts/1/payments': () => {
        current = {
          ...loan,
          balance_cents: 500000,
          payments: [...loan.payments, { id: 10, date: '2026-10-09', amount_cents: 250000 }],
        };
        return { status: 201, body: {} };
      },
    });
    render(<DebtsPage />);
    const card = await screen.findByRole('region', { name: 'Empréstimo' });
    await userEvent.click(within(card).getByRole('button', { name: '+ Pagamento' }));
    const dialog = screen.getByRole('dialog', { name: 'Pagamento: Empréstimo' });
    await userEvent.type(within(dialog).getByLabelText('Valor do pagamento'), '2.500,00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pagamento' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.called('POST', '/api/debts/1/payments')).toHaveLength(1);
    const refreshed = await screen.findByRole('region', { name: 'Empréstimo' });
    await waitFor(() => expect(within(refreshed).getByText('R$ 5.000,00')).toBeInTheDocument());
    expect(
      within(refreshed).getByRole('button', { name: 'Excluir pagamento de 09/10/2026' }),
    ).toBeInTheDocument();
  });

  it('puts "+ Nova dívida" in the page header next to the title (L6)', async () => {
    mockApi({ 'GET /api/debts': [loan] });
    render(<DebtsPage />);
    await screen.findByRole('region', { name: 'Empréstimo' });
    const button = screen.getByRole('button', { name: '+ Nova dívida' });
    expect(screen.getByRole('heading', { level: 1, name: 'Dívidas' }).parentElement).toContainElement(button);
  });
});
