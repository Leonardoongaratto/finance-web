import { useCallback, useId, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../components/forms';
import { AsyncView, Badge, Card, EmptyState, Field, FormError, Loading, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { formatBRL, formatDate } from '../lib/format';
import { useResource } from '../lib/useResource';
import type { Account, Category, ImportPreviewRow } from '../types';

export default function ImportPage() {
  const loader = useCallback(() => api.listAccounts(), []);
  const resource = useResource(loader);

  return (
    <>
      <PageHeader title="Importar extrato" />
      <AsyncView
        resource={resource}
        isEmpty={(accounts) => accounts.length === 0}
        empty={
          <EmptyState
            title="Cadastre uma conta primeiro"
            description="Para importar um extrato, cadastre a conta correspondente em Transações."
          >
            <Link className="btn btn-primary" to="/transacoes">
              Ir para Transações
            </Link>
          </EmptyState>
        }
      >
        {(accounts) => <ImportFlow accounts={accounts} />}
      </AsyncView>
    </>
  );
}

interface PreviewRowState extends ImportPreviewRow {
  selected: boolean;
  categoryId: number;
}

type Phase = 'select' | 'loading' | 'preview' | 'confirming' | 'done';

function ImportFlow({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState(String(accounts[0]?.id ?? ''));
  const [phase, setPhase] = useState<Phase>('select');
  const [error, setError] = useState<string>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<PreviewRowState[]>([]);
  // Snapshot of the account the loaded preview belongs to: the confirm must
  // always target this account, never whatever the <select> shows later, so
  // that changing the account after a preview can't silently mix duplicate
  // flags and suggestions computed for a different account.
  const [previewAccountId, setPreviewAccountId] = useState<number>();
  const [summary, setSummary] = useState<{ created: number; skippedDuplicates: number }>();

  function resetPreview() {
    setPhase('select');
    setRows([]);
    setPreviewAccountId(undefined);
    setSummary(undefined);
    setError(undefined);
  }

  async function handleFile(file: File) {
    setError(undefined);
    setRows([]);
    setPreviewAccountId(undefined);
    setPhase('loading');
    try {
      const [preview, loadedCategories] = await Promise.all([
        api.previewOFXImport(Number(accountId), file),
        api.listCategories(),
      ]);
      setCategories(loadedCategories);
      setPreviewAccountId(preview.account_id);
      setRows(
        preview.rows.map((row) => ({
          ...row,
          selected: !row.is_duplicate,
          categoryId: row.suggested_category_id,
        })),
      );
      setPhase('preview');
    } catch (failure) {
      setError(errorMessage(failure));
      setPhase('select');
    }
  }

  function toggleRow(index: number) {
    setRows((previous) =>
      previous.map((row, i) => (i === index ? { ...row, selected: !row.selected } : row)),
    );
  }

  function changeCategory(index: number, categoryId: number) {
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, categoryId } : row)));
  }

  async function handleConfirm() {
    if (previewAccountId === undefined) return;
    setPhase('confirming');
    setError(undefined);
    try {
      const response = await api.confirmOFXImport({
        account_id: previewAccountId,
        rows: rows
          .filter((row) => row.selected)
          .map((row) => ({
            source_ref: row.source_ref,
            date: row.date,
            amount_cents: row.amount_cents,
            type: row.type,
            category_id: row.categoryId,
            description: row.description,
          })),
      });
      setSummary({ created: response.created, skippedDuplicates: response.skipped_duplicates });
      setPhase('done');
    } catch (failure) {
      setError(errorMessage(failure));
      setPhase('preview');
    }
  }

  if (phase === 'done' && summary) {
    return (
      <Card title="Importação concluída">
        <p>
          {summary.created} lançamento(s) criado(s). {summary.skippedDuplicates} ignorado(s) por já estarem
          importados.
        </p>
        <Link className="btn btn-primary" to="/transacoes">
          Ver extrato
        </Link>
      </Card>
    );
  }

  const hasSelection = rows.some((row) => row.selected);
  const hasPreview = rows.length > 0;
  const busy = phase === 'loading' || phase === 'confirming';

  return (
    <>
      <Card title="Escolha a conta e o arquivo">
        <Field label="Conta">
          {(props) => (
            <select
              {...props}
              value={accountId}
              disabled={phase !== 'select'}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <FileDropzone disabled={busy} onFile={handleFile} />
        {phase !== 'select' && (
          <div className="form-actions">
            <button type="button" className="btn btn-small" onClick={resetPreview} disabled={busy}>
              Trocar conta ou arquivo
            </button>
          </div>
        )}
        <FormError message={error} />
      </Card>

      {phase === 'loading' && <Loading label="Analisando arquivo…" />}

      {phase === 'preview' && !hasPreview && (
        <EmptyState
          title="Nenhum lançamento encontrado"
          description="O arquivo não contém transações para importar."
        />
      )}

      {hasPreview && (
        <Card title={`Prévia (${rows.length} lançamento(s))`}>
          <ul className="list" aria-label="Prévia da importação">
            {rows.map((row, index) => (
              <li key={row.source_ref + String(index)} className="list-row">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => toggleRow(index)}
                  aria-label={`Importar ${row.description || row.source_ref}`}
                />
                <span className="grow">
                  {formatDate(row.date)} · {row.description || '(sem descrição)'}
                </span>
                <strong className={row.type === 'income' ? 'positive' : 'negative'}>
                  {row.type === 'income' ? '+' : '-'}
                  {formatBRL(row.amount_cents)}
                </strong>
                <select
                  aria-label={`Categoria de ${row.description || row.source_ref}`}
                  value={row.categoryId}
                  onChange={(e) => changeCategory(index, Number(e.target.value))}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {row.is_duplicate && <Badge tone="warning">Já importado</Badge>}
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasSelection || phase === 'confirming'}
              onClick={handleConfirm}
            >
              Confirmar importação
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

function FileDropzone({ onFile, disabled }: { onFile: (file: File) => void; disabled: boolean }) {
  const inputId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>Arquivo OFX</label>
      <div className="state state-box" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <p className="muted">Arraste o arquivo .ofx aqui ou escolha abaixo.</p>
        <input id={inputId} type="file" accept=".ofx" onChange={handleChange} disabled={disabled} />
      </div>
    </div>
  );
}
