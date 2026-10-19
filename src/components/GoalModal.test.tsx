import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '../test/mockApi';
import { GoalModal } from './GoalModal';

describe('GoalModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<GoalModal isOpen={false} onClose={() => {}} onSaved={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders simulator live as user enters amount and deadline', async () => {
    render(<GoalModal isOpen={true} onClose={() => {}} onSaved={() => {}} />);

    await userEvent.type(screen.getByLabelText('Nome da meta'), 'Casa Própria');
    await userEvent.type(screen.getByLabelText('Valor-alvo'), '120.000');
    await userEvent.clear(screen.getByLabelText('Prazo'));
    await userEvent.type(screen.getByLabelText('Prazo'), '2028-10-01');

    // Live simulation feedback must appear
    expect(screen.getByRole('region', { name: 'Simulação do plano' })).toBeInTheDocument();
    expect(screen.getByText(/Você precisa investir por mês:/)).toBeInTheDocument();
  });

  it('submits valid goal to API', async () => {
    const api = mockApi({
      'POST /api/goals': { status: 201, body: { id: 1 } },
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<GoalModal isOpen={true} onClose={onClose} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText('Nome da meta'), 'Casa');
    await userEvent.type(screen.getByLabelText('Valor-alvo'), '50000');
    await userEvent.clear(screen.getByLabelText('Prazo'));
    await userEvent.type(screen.getByLabelText('Prazo'), '2027-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));

    await waitFor(() => expect(api.called('POST', '/api/goals')).toHaveLength(1));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
