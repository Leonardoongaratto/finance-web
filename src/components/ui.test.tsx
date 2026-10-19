import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Resource } from '../lib/useResource';
import {
  AsyncView,
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FormError,
  PageHeader,
  ProgressBar,
} from './ui';
import { useConfirm } from './useConfirm';

function resource<T>(partial: Partial<Resource<T>>): Resource<T> {
  return { data: undefined, error: undefined, loading: false, reload: () => {}, ...partial };
}

describe('AsyncView', () => {
  it('shows loading while there is no data', () => {
    render(<AsyncView resource={resource<string>({ loading: true })}>{(d) => <p>{d}</p>}</AsyncView>);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  });

  it('shows the error with a retry button', async () => {
    const reload = vi.fn();
    render(
      <AsyncView resource={resource<string>({ error: new Error('falhou'), reload })}>
        {(d) => <p>{d}</p>}
      </AsyncView>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('falhou');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(reload).toHaveBeenCalled();
  });

  it('shows the empty state when the data is empty', () => {
    render(
      <AsyncView
        resource={resource<string[]>({ data: [] })}
        isEmpty={(d) => d.length === 0}
        empty={<p>vazio</p>}
      >
        {() => <p>cheio</p>}
      </AsyncView>,
    );
    expect(screen.getByText('vazio')).toBeInTheDocument();
  });

  it('renders children with the data', () => {
    render(<AsyncView resource={resource({ data: 'conteudo' })}>{(d) => <p>{d}</p>}</AsyncView>);
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });
});

describe('building blocks', () => {
  it('renders empty state, header, card and badge', () => {
    render(
      <>
        <PageHeader title="Título">
          <span>extra</span>
        </PageHeader>
        <EmptyState title="Nada" description="Comece aqui">
          <button>Criar</button>
        </EmptyState>
        <Card title="Cartão">conteúdo</Card>
        <Card>sem título</Card>
        <Badge tone="success">ok</Badge>
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Nada' })).toHaveTextContent('Comece aqui');
    expect(screen.getByRole('region', { name: 'Cartão' })).toBeInTheDocument();
    expect(screen.getByText('ok')).toHaveClass('badge-success');
  });

  it('links field label, input and error', () => {
    render(
      <Field label="Valor" error="Informe um valor">
        {(props) => <input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText('Valor');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Informe um valor');
  });

  it('renders a valid field without error', () => {
    render(<Field label="Nome">{(props) => <input {...props} />}</Field>);
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'false');
  });

  it('clamps the progress bar', () => {
    const { rerender } = render(<ProgressBar value={150} label="Meta" />);
    expect(screen.getByRole('progressbar', { name: 'Meta' })).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={-5} label="Meta" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders the form error only when there is a message', () => {
    const { rerender } = render(<FormError />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<FormError message="Erro ao salvar" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao salvar');
  });
});

describe('ConfirmDialog', () => {
  it('calls the right callbacks', async () => {
    const onConfirm = vi.fn();
    const onExtra = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Excluir?"
        message="Tem certeza"
        extraLabel="Todas"
        onConfirm={onConfirm}
        onExtra={onExtra}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('alertdialog', { name: 'Excluir?' })).toHaveTextContent('Tem certeza');
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onExtra).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('hides the extra button without a handler', () => {
    render(<ConfirmDialog title="t" message="m" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

describe('useConfirm', () => {
  function Harness({ onConfirm, onExtra }: { onConfirm: () => void; onExtra?: () => void }) {
    const { ask, dialog } = useConfirm();
    return (
      <>
        <button
          onClick={() =>
            ask({
              title: 'Excluir item?',
              message: 'Isso não pode ser desfeito',
              onConfirm,
              onExtra,
              extraLabel: onExtra ? 'Excluir tudo' : undefined,
            })
          }
        >
          pedir
        </button>
        {dialog}
      </>
    );
  }

  it('asks first and only acts after confirmation', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('pedir'));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('does nothing on cancel', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('pedir'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('supports the extra action', async () => {
    const onExtra = vi.fn();
    render(<Harness onConfirm={() => {}} onExtra={onExtra} />);
    await userEvent.click(screen.getByText('pedir'));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir tudo' }));
    expect(onExtra).toHaveBeenCalledTimes(1);
  });
});
