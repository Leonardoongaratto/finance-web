import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp as render } from '../test/render';
import { apiError, mockApi } from '../test/mockApi';
import type { Account, Category, ImportPreviewResponse } from '../types';
import ImportPage from './ImportPage';

const accounts: Account[] = [
  { id: 1, name: 'Nubank', type: 'checking' },
  { id: 2, name: 'C6', type: 'checking' },
];
const categories: Category[] = [
  { id: 1, name: 'Alimentação' },
  { id: 9, name: 'Outros' },
];

function ofxFile(name = 'extrato.ofx') {
  return new File(['<OFX></OFX>'], name, { type: 'application/octet-stream' });
}

function previewWith(overrides: Partial<ImportPreviewResponse> = {}): ImportPreviewResponse {
  return {
    account_id: 1,
    rows: [
      {
        source_ref: 'NUB-001',
        date: '2026-10-01',
        amount_cents: 12345,
        type: 'expense',
        description: 'Compra no mercado',
        suggested_category_id: 1,
        suggested_category_name: 'Alimentação',
        is_duplicate: false,
      },
    ],
    summary: { total: 1, duplicates: 0 },
    ...overrides,
  };
}

describe('ImportPage', () => {
  it('shows the empty state asking to register an account first', async () => {
    mockApi({ 'GET /api/accounts': [] });
    render(<ImportPage />);
    expect(await screen.findByRole('heading', { name: /cadastre uma conta/i })).toBeInTheDocument();
  });

  it('uploads the file and renders one preview row per transaction, pre-checked', async () => {
    mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith(),
      'GET /api/categories': categories,
    });
    render(<ImportPage />);

    const input = await screen.findByLabelText('Arquivo OFX');
    await userEvent.upload(input, ofxFile());

    const checkbox = await screen.findByRole('checkbox', { name: /compra no mercado/i });
    expect(checkbox).toBeChecked();
    expect(screen.getByText(/Alimentação/)).toBeInTheDocument();
  });

  it('pre-unchecks a duplicate row and flags it', async () => {
    mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith({
        rows: [
          {
            source_ref: 'NUB-001',
            date: '2026-10-01',
            amount_cents: 12345,
            type: 'expense',
            description: 'Compra no mercado',
            suggested_category_id: 9,
            suggested_category_name: 'Outros',
            is_duplicate: true,
          },
        ],
        summary: { total: 1, duplicates: 1 },
      }),
      'GET /api/categories': categories,
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile());

    const checkbox = await screen.findByRole('checkbox', { name: /compra no mercado/i });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('Já importado')).toBeInTheDocument();
  });

  it('shows an empty preview when the file has no transactions', async () => {
    mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith({ rows: [], summary: { total: 0, duplicates: 0 } }),
      'GET /api/categories': categories,
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile());
    expect(await screen.findByText(/nenhum lançamento encontrado/i)).toBeInTheDocument();
  });

  it('shows the server message for an invalid OFX file', async () => {
    mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': apiError(400, 'invalid_ofx', 'O arquivo não é um OFX válido.'),
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile());
    expect(await screen.findByText('O arquivo não é um OFX válido.')).toBeInTheDocument();
  });

  it('confirms only checked rows and shows the created/skipped summary with a link to the statement', async () => {
    const api = mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith({
        rows: [
          {
            source_ref: 'NUB-001',
            date: '2026-10-01',
            amount_cents: 12345,
            type: 'expense',
            description: 'Compra no mercado',
            suggested_category_id: 1,
            suggested_category_name: 'Alimentação',
            is_duplicate: false,
          },
          {
            source_ref: 'NUB-002',
            date: '2026-10-02',
            amount_cents: 5000,
            type: 'income',
            description: 'Salario',
            suggested_category_id: 9,
            suggested_category_name: 'Outros',
            is_duplicate: false,
          },
        ],
        summary: { total: 2, duplicates: 0 },
      }),
      'GET /api/categories': categories,
      'POST /api/import/ofx/confirm': { status: 201, body: { created: 1, skipped_duplicates: 0 } },
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile());

    await userEvent.click(await screen.findByRole('checkbox', { name: /salario/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(api.called('POST', '/api/import/ofx/confirm')).toHaveLength(1));
    const sentRows = api.called('POST', '/api/import/ofx/confirm')[0]?.body as {
      rows: { source_ref: string }[];
    };
    expect(sentRows.rows).toHaveLength(1);
    expect(sentRows.rows[0]?.source_ref).toBe('NUB-001');

    expect(await screen.findByText(/1 lançamento/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver extrato/i })).toHaveAttribute('href', '/transacoes');
  });

  it('reimporting the same file shows every row as a duplicate, pre-unchecked, confirming creates zero', async () => {
    const api = mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith({
        rows: [
          {
            source_ref: 'NUB-001',
            date: '2026-10-01',
            amount_cents: 12345,
            type: 'expense',
            description: 'Compra no mercado',
            suggested_category_id: 1,
            suggested_category_name: 'Alimentação',
            is_duplicate: true,
          },
        ],
        summary: { total: 1, duplicates: 1 },
      }),
      'GET /api/categories': categories,
      'POST /api/import/ofx/confirm': { status: 201, body: { created: 0, skipped_duplicates: 0 } },
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile());

    const confirmButton = await screen.findByRole('button', { name: 'Confirmar importação' });
    expect(confirmButton).toBeDisabled();
    expect(api.called('POST', '/api/import/ofx/confirm')).toHaveLength(0);
  });

  it('locks the account selector after a preview loads and sends the confirm for that same account', async () => {
    const api = mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith(),
      'GET /api/categories': categories,
      'POST /api/import/ofx/confirm': { status: 201, body: { created: 1, skipped_duplicates: 0 } },
    });
    render(<ImportPage />);
    const select = await screen.findByLabelText('Conta');
    expect(select).not.toBeDisabled();

    await userEvent.upload(screen.getByLabelText('Arquivo OFX'), ofxFile());
    await screen.findByRole('checkbox', { name: /compra no mercado/i });
    expect(select).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    await waitFor(() => expect(api.called('POST', '/api/import/ofx/confirm')).toHaveLength(1));
    expect(api.called('POST', '/api/import/ofx/confirm')[0]?.body).toMatchObject({ account_id: 1 });
  });

  it('clears the previous preview and re-enables the account selector via "Trocar conta ou arquivo"', async () => {
    mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith(),
      'GET /api/categories': categories,
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile());
    await screen.findByRole('checkbox', { name: /compra no mercado/i });

    await userEvent.click(screen.getByRole('button', { name: 'Trocar conta ou arquivo' }));
    expect(screen.queryByRole('checkbox', { name: /compra no mercado/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Conta')).not.toBeDisabled();
  });

  it('clears a previous preview as soon as a new file is chosen, even if the new upload fails', async () => {
    let callCount = 0;
    mockApi({
      'GET /api/accounts': accounts,
      'GET /api/categories': categories,
      'POST /api/import/ofx/preview': () => {
        callCount += 1;
        return callCount === 1 ? previewWith() : apiError(400, 'invalid_ofx', 'Arquivo inválido.');
      },
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile('primeiro.ofx'));
    await screen.findByRole('checkbox', { name: /compra no mercado/i });

    await userEvent.upload(screen.getByLabelText('Arquivo OFX'), ofxFile('segundo.ofx'));
    await screen.findByText('Arquivo inválido.');
    expect(screen.queryByRole('checkbox', { name: /compra no mercado/i })).not.toBeInTheDocument();
  });

  it('disables the file input while a confirm is in flight', async () => {
    mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith(),
      'GET /api/categories': categories,
    });
    render(<ImportPage />);
    await userEvent.upload(await screen.findByLabelText('Arquivo OFX'), ofxFile());
    await screen.findByRole('checkbox', { name: /compra no mercado/i });

    const delegate = global.fetch;
    let resolveConfirm: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/api/import/ofx/confirm')) {
          return new Promise<Response>((resolve) => {
            resolveConfirm = resolve;
          });
        }
        return delegate(input, init);
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    expect(screen.getByLabelText('Arquivo OFX')).toBeDisabled();
    resolveConfirm?.(new Response(JSON.stringify({ created: 1, skipped_duplicates: 0 }), { status: 201 }));
  });

  it('accepts a file dropped on the dropzone', async () => {
    mockApi({
      'GET /api/accounts': accounts,
      'POST /api/import/ofx/preview': previewWith(),
      'GET /api/categories': categories,
    });
    render(<ImportPage />);
    const dropzone = (await screen.findByLabelText('Arquivo OFX')).closest('.state');
    if (!dropzone) throw new Error('dropzone not found');

    const file = ofxFile();
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(await screen.findByRole('checkbox', { name: /compra no mercado/i })).toBeInTheDocument();
  });
});
