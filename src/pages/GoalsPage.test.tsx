import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, mockApi } from '../test/mockApi';
import type { Goal } from '../types';
import GoalsPage from './GoalsPage';

const trip: Goal = {
  id: 1,
  name: 'Viagem',
  target_cents: 1200000,
  deadline: '2027-07-02',
  start_date: '2026-10-01',
  saved_cents: 300000,
  progress_pct: 25,
  remaining_cents: 900000,
  months_left: 9,
  monthly_needed_cents: 100000,
  status: 'on_track',
  contributions: [{ id: 5, date: '2026-10-02', amount_cents: 300000 }],
};

describe('GoalsPage', () => {
  it('shows the empty state with a call to register the first goal', async () => {
    mockApi({ 'GET /api/goals': [] });
    render(<GoalsPage />);
    expect(await screen.findByRole('heading', { name: 'Cadastre sua primeira meta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da meta')).toBeInTheDocument();
  });

  it('creates a goal with the target in cents', async () => {
    const api = mockApi({ 'GET /api/goals': [], 'POST /api/goals': { status: 201, body: trip } });
    render(<GoalsPage />);
    await userEvent.type(await screen.findByLabelText('Nome da meta'), 'Reserva');
    await userEvent.type(screen.getByLabelText('Valor-alvo'), '12.000');
    await userEvent.clear(screen.getByLabelText('Prazo'));
    await userEvent.type(screen.getByLabelText('Prazo'), '2027-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => expect(api.called('POST', '/api/goals')).toHaveLength(1));
    expect(api.called('POST', '/api/goals')[0]?.body).toEqual({
      name: 'Reserva',
      target_cents: 1200000,
      deadline: '2027-12-31',
    });
  });

  it('validates the goal form inline', async () => {
    const api = mockApi({ 'GET /api/goals': [] });
    render(<GoalsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar meta' }));
    expect(screen.getByText('Informe o nome da meta.')).toBeInTheDocument();
    expect(screen.getByText('Informe um valor válido, como 1.234,56.')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('shows progress, remaining amount and monthly need', async () => {
    mockApi({ 'GET /api/goals': [trip] });
    render(<GoalsPage />);
    const card = await screen.findByRole('region', { name: 'Viagem' });
    expect(within(card).getByRole('progressbar', { name: 'Progresso de Viagem' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(within(card).getByText('25%')).toBeInTheDocument();
    expect(within(card).getByText('R$ 9.000,00')).toBeInTheDocument();
    expect(within(card).getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(within(card).getByText('02/07/2027')).toBeInTheDocument();
    expect(within(card).getByText('No ritmo')).toBeInTheDocument();
  });

  it.each([
    ['behind', 'Abaixo do ritmo'],
    ['overdue', 'Prazo vencido'],
    ['done', 'Concluída'],
  ] as const)('labels the %s status', async (status, label) => {
    mockApi({ 'GET /api/goals': [{ ...trip, status, remaining_cents: status === 'done' ? 0 : 900000 }] });
    render(<GoalsPage />);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('registers a contribution', async () => {
    const api = mockApi({
      'GET /api/goals': [trip],
      'POST /api/goals/1/contributions': { status: 201, body: {} },
    });
    render(<GoalsPage />);
    const card = await screen.findByRole('region', { name: 'Viagem' });
    await userEvent.type(within(card).getByLabelText('Valor do aporte'), '500');
    await userEvent.click(within(card).getByRole('button', { name: 'Registrar aporte' }));
    await waitFor(() => expect(api.called('POST', '/api/goals/1/contributions')).toHaveLength(1));
    expect(api.called('POST', '/api/goals/1/contributions')[0]?.body).toMatchObject({ amount_cents: 50000 });
  });

  it('shows API errors from the contribution form', async () => {
    mockApi({
      'GET /api/goals': [trip],
      'POST /api/goals/1/contributions': apiError(400, 'validation_error', 'amount_cents out of range'),
    });
    render(<GoalsPage />);
    const card = await screen.findByRole('region', { name: 'Viagem' });
    await userEvent.type(within(card).getByLabelText('Valor do aporte'), '500');
    await userEvent.click(within(card).getByRole('button', { name: 'Registrar aporte' }));
    expect(await within(card).findByText('amount_cents out of range')).toBeInTheDocument();
  });

  it('deletes a contribution and a goal after confirmation', async () => {
    const api = mockApi({
      'GET /api/goals': [trip],
      'DELETE /api/goals/1/contributions/5': { status: 204 },
      'DELETE /api/goals/1': { status: 204 },
    });
    render(<GoalsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir aporte de 02/10/2026' }));
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/goals/1/contributions/5')).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Excluir meta Viagem' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/goals/1')).toHaveLength(1));
  });

  it('shows failures when deleting', async () => {
    mockApi({ 'GET /api/goals': [trip], 'DELETE /api/goals/1': apiError(500, 'internal', 'internal error') });
    render(<GoalsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir meta Viagem' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    mockApi({ 'GET /api/goals': apiError(500, 'internal', 'Falha ao carregar') });
    render(<GoalsPage />);
    expect(await screen.findByText('Falha ao carregar')).toBeInTheDocument();
  });

  it('opens the new goal modal and displays the interactive simulation', async () => {
    mockApi({ 'GET /api/goals': [trip] });
    render(<GoalsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir formulário de nova meta' }));
    expect(screen.getByRole('dialog', { name: 'Nova Meta Financeira' })).toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: 'Nova Meta Financeira' });
    await userEvent.type(within(dialog).getByLabelText('Valor-alvo'), '24.000');
    await userEvent.clear(within(dialog).getByLabelText('Prazo'));
    await userEvent.type(within(dialog).getByLabelText('Prazo'), '2028-10-01');

    expect(within(dialog).getByRole('region', { name: 'Simulação do plano' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Você precisa investir por mês:/)).toBeInTheDocument();
  });

  it('opens the contribute modal when clicking Guardar', async () => {
    mockApi({ 'GET /api/goals': [trip] });
    render(<GoalsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar dinheiro na meta Viagem' }));
    expect(screen.getByRole('dialog', { name: 'Guardar na meta: Viagem' })).toBeInTheDocument();
  });
});
