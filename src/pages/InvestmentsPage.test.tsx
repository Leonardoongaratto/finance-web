import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, mockApi } from '../test/mockApi';
import type { Investment } from '../types';
import InvestmentsPage from './InvestmentsPage';

const cdb: Investment = {
  id: 1,
  name: 'CDB Banco',
  type: 'fixed_income',
  invested_cents: 150000,
  current_cents: 180000,
  gain_cents: 30000,
  return_pct: 20,
  contributions: [
    { id: 1, date: '2026-01-10', amount_cents: 100000 },
    { id: 2, date: '2026-02-10', amount_cents: 50000 },
  ],
  valuations: [{ id: 1, date: '2026-03-10', value_cents: 180000 }],
};

describe('InvestmentsPage', () => {
  it('shows the empty state with a call to register the first investment', async () => {
    mockApi({ 'GET /api/investments': [] });
    render(<InvestmentsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Cadastre seu primeiro investimento' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do investimento')).toBeInTheDocument();
  });

  it('creates an investment', async () => {
    const api = mockApi({
      'GET /api/investments': [],
      'POST /api/investments': { status: 201, body: { id: 1, name: 'CDB', type: 'treasury' } },
    });
    render(<InvestmentsPage />);
    await userEvent.type(await screen.findByLabelText('Nome do investimento'), 'Tesouro');
    await userEvent.selectOptions(screen.getByLabelText('Tipo de investimento'), 'treasury');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar investimento' }));
    await waitFor(() =>
      expect(api.called('POST', '/api/investments')[0]?.body).toEqual({ name: 'Tesouro', type: 'treasury' }),
    );
  });

  it('validates the investment name', async () => {
    mockApi({ 'GET /api/investments': [] });
    render(<InvestmentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar investimento' }));
    expect(screen.getByText('Informe o nome do investimento.')).toBeInTheDocument();
  });

  it('shows invested, current value and gain', async () => {
    mockApi({ 'GET /api/investments': [cdb] });
    render(<InvestmentsPage />);
    const card = await screen.findByRole('region', { name: 'CDB Banco' });
    expect(within(card).getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(within(card).getAllByText('R$ 1.800,00').length).toBeGreaterThan(0);
    expect(within(card).getByText('+R$ 300,00 (20%)')).toBeInTheDocument();
    expect(within(card).getByText('Renda fixa')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Resumo' });
    expect(within(summary).getByText('R$ 1.800,00')).toBeInTheDocument();
  });

  it('shows a negative gain in red', async () => {
    mockApi({
      'GET /api/investments': [{ ...cdb, gain_cents: -1000, return_pct: -5, current_cents: 149000 }],
    });
    render(<InvestmentsPage />);
    const gain = await screen.findAllByText('-R$ 10,00 (-5%)');
    expect(gain[0]).toHaveClass('negative');
  });

  it('registers a contribution and a valuation', async () => {
    const api = mockApi({
      'GET /api/investments': [cdb],
      'POST /api/investments/1/contributions': { status: 201, body: {} },
      'POST /api/investments/1/valuations': { status: 201, body: {} },
    });
    render(<InvestmentsPage />);
    const card = await screen.findByRole('region', { name: 'CDB Banco' });
    await userEvent.type(within(card).getByLabelText('Valor do aporte'), '250,50');
    await userEvent.click(within(card).getByRole('button', { name: 'Registrar aporte' }));
    await waitFor(() => expect(api.called('POST', '/api/investments/1/contributions')).toHaveLength(1));
    expect(api.called('POST', '/api/investments/1/contributions')[0]?.body).toMatchObject({
      amount_cents: 25050,
    });

    await userEvent.type(within(card).getByLabelText('Valor atual'), '0');
    await userEvent.click(within(card).getByRole('button', { name: 'Registrar avaliação' }));
    await waitFor(() => expect(api.called('POST', '/api/investments/1/valuations')).toHaveLength(1));
    expect(api.called('POST', '/api/investments/1/valuations')[0]?.body).toMatchObject({ value_cents: 0 });
  });

  it('rejects an invalid contribution amount inline', async () => {
    const api = mockApi({ 'GET /api/investments': [cdb] });
    render(<InvestmentsPage />);
    const card = await screen.findByRole('region', { name: 'CDB Banco' });
    await userEvent.click(within(card).getByRole('button', { name: 'Registrar aporte' }));
    expect(within(card).getByText('Informe um valor válido, como 1.234,56.')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('deletes entries and investments only after confirmation', async () => {
    const api = mockApi({
      'GET /api/investments': [cdb],
      'DELETE /api/investments/1/contributions/1': { status: 204 },
      'DELETE /api/investments/1/valuations/1': { status: 204 },
      'DELETE /api/investments/1': { status: 204 },
    });
    render(<InvestmentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir aporte de 10/01/2026' }));
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/investments/1/contributions/1')).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Excluir avaliação de 10/03/2026' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/investments/1/valuations/1')).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Excluir investimento CDB Banco' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.called('DELETE', '/api/investments/1')).toHaveLength(1));
  });

  it('shows failures when deleting', async () => {
    mockApi({
      'GET /api/investments': [cdb],
      'DELETE /api/investments/1': apiError(500, 'internal', 'internal error'),
    });
    render(<InvestmentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir investimento CDB Banco' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    mockApi({ 'GET /api/investments': apiError(500, 'internal', 'Falha ao carregar') });
    render(<InvestmentsPage />);
    expect(await screen.findByText('Falha ao carregar')).toBeInTheDocument();
  });
});
