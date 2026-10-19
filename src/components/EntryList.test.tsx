import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntryList, type Entry } from './EntryList';

const entries: Entry[] = Array.from({ length: 7 }, (_, i) => ({
  id: i + 1,
  date: `2026-0${i + 1}-10`,
  cents: 150000,
}));

describe('EntryList', () => {
  it('shows the 5 most recent entries and expands to all of them', async () => {
    render(<EntryList title="Pagamentos" itemLabel="pagamento" entries={entries} onDelete={vi.fn()} />);
    const list = screen.getByRole('list', { name: 'Pagamentos' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('10/07/2026');
    expect(within(list).queryByText('10/02/2026')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Ver todos (7)' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(7);

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar menos' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
  });

  it('puts the amount and the delete button together after the date', () => {
    const onDelete = vi.fn();
    render(
      <EntryList
        title="Pagamentos"
        itemLabel="pagamento"
        entries={entries.slice(0, 2)}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByRole('button', { name: /Ver todos/ })).toBeNull();
    const row = screen.getAllByRole('listitem')[0];
    const actions = row?.querySelector('.entry-actions');
    expect(actions).not.toBeNull();
    expect(actions).toHaveTextContent('R$ 1.500,00');
    expect(
      within(actions as HTMLElement).getByRole('button', { name: 'Excluir pagamento de 10/02/2026' }),
    ).toBeInTheDocument();
  });
});
