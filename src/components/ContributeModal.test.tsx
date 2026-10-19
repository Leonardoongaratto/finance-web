import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiError, mockApi } from '../test/mockApi';
import type { Goal } from '../types';
import { ContributeModal } from './ContributeModal';

const sampleGoal: Goal = {
  id: 1,
  name: 'Carro Novo',
  target_cents: 5000000,
  deadline: '2028-12-31',
  start_date: '2026-10-01',
  saved_cents: 1000000,
  progress_pct: 20,
  remaining_cents: 4000000,
  months_left: 26,
  monthly_needed_cents: 153847,
  status: 'on_track',
  contributions: [],
};

describe('ContributeModal', () => {
  it('does not render if goal is null or isOpen is false', () => {
    const { container } = render(
      <ContributeModal goal={null} isOpen={false} onClose={() => {}} onSaved={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('submits a contribution successfully with quick suggested amount', async () => {
    const api = mockApi({
      'POST /api/goals/1/contributions': { status: 201, body: {} },
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<ContributeModal goal={sampleGoal} isOpen={true} onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByRole('dialog', { name: /Guardar na meta: Carro Novo/ })).toBeInTheDocument();

    // Click quick suggestion button
    await userEvent.click(screen.getByRole('button', { name: /Usar valor do mês/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    await waitFor(() => expect(api.called('POST', '/api/goals/1/contributions')).toHaveLength(1));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error if API fails', async () => {
    mockApi({
      'POST /api/goals/1/contributions': apiError(400, 'validation_error', 'Valor inválido'),
    });

    render(<ContributeModal goal={sampleGoal} isOpen={true} onClose={() => {}} onSaved={() => {}} />);

    await userEvent.type(screen.getByLabelText('Valor do aporte'), '200');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    expect(await screen.findByText('Valor inválido')).toBeInTheDocument();
  });
});
