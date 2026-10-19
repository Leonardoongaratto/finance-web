import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { todayISO } from '../lib/format';
import { compact, validAmount, validDate, type FormErrors } from '../lib/validation';
import type { Account, Category, TransactionType } from '../types';
import { CurrencyInput } from './CurrencyInput';
import { Modal } from './Modal';
import { Field, FormError } from './ui';

export interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  accounts?: Account[];
  categories?: Category[];
}

export function QuickCaptureModal({
  isOpen,
  onClose,
  onSaved,
  accounts = [],
  categories = [],
}: QuickCaptureModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => todayISO());
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [installments, setInstallments] = useState(false);
  const [count, setCount] = useState('2');
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const [fetchedAccounts, setFetchedAccounts] = useState<Account[]>([]);
  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([]);

  const availableAccounts = accounts.length > 0 ? accounts : fetchedAccounts;
  const availableCategories = categories.length > 0 ? categories : fetchedCategories;

  const activeAccountId = accountId || (availableAccounts[0] ? String(availableAccounts[0].id) : '');
  const activeCategoryId = categoryId || (availableCategories[0] ? String(availableCategories[0].id) : '');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    if (accounts.length === 0 && fetchedAccounts.length === 0) {
      void api.listAccounts().then((accs) => {
        if (!cancelled) setFetchedAccounts(accs);
      });
    }

    if (categories.length === 0 && fetchedCategories.length === 0) {
      void api.listCategories().then((cats) => {
        if (!cancelled) setFetchedCategories(cats);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, accounts.length, categories.length, fetchedAccounts.length, fetchedCategories.length]);

  function reset() {
    setAmount('');
    setDescription('');
    setDate(todayISO());
    setInstallments(false);
    setCount('2');
    setAccountId('');
    setCategoryId('');
    setErrors({});
    setSubmitError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = validAmount(amount);
    const parsedCount = Number(count);
    const useInstallments = installments && type === 'expense';
    const found = compact({
      amount: parsedAmount.error,
      date: validDate(date),
      account: activeAccountId ? undefined : 'Selecione uma conta.',
      category: activeCategoryId ? undefined : 'Selecione uma categoria.',
      count:
        useInstallments && !(Number.isInteger(parsedCount) && parsedCount >= 2 && parsedCount <= 48)
          ? 'Use entre 2 e 48 parcelas.'
          : undefined,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSubmitError(undefined);

    try {
      const base = {
        account_id: Number(activeAccountId),
        category_id: Number(activeCategoryId),
        description: description.trim(),
      };
      if (useInstallments) {
        await api.createInstallments({
          ...base,
          total_cents: parsedAmount.cents ?? 0,
          installments: parsedCount,
          first_date: date,
        });
      } else {
        await api.createTransaction({
          ...base,
          type,
          amount_cents: parsedAmount.cents ?? 0,
          date,
        });
      }
      reset();
      onSaved();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível salvar o lançamento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={type === 'expense' ? 'Nova Despesa' : 'Nova Receita'}>
      <form onSubmit={handleSubmit} noValidate className="form">
        <div className="segmented" role="group" aria-label="Tipo de transação">
          <button
            type="button"
            className={type === 'expense' ? 'active' : ''}
            aria-pressed={type === 'expense'}
            onClick={() => setType('expense')}
          >
            💸 Despesa
          </button>
          <button
            type="button"
            className={type === 'income' ? 'active' : ''}
            aria-pressed={type === 'income'}
            onClick={() => setType('income')}
          >
            💰 Receita
          </button>
        </div>

        <Field label="Valor" error={errors.amount}>
          {(props) => (
            <CurrencyInput
              {...props}
              value={amount}
              onChange={setAmount}
              autoFocus
              aria-label="Valor do lançamento"
            />
          )}
        </Field>

        {availableCategories.length > 0 && (
          <div className="field">
            <label id="quick-cat-label">Categoria rápida</label>
            <div className="category-chips-row" role="group" aria-labelledby="quick-cat-label">
              {availableCategories.slice(0, 6).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`chip-btn ${activeCategoryId === String(cat.id) ? 'active' : ''}`}
                  onClick={() => setCategoryId(String(cat.id))}
                  aria-pressed={activeCategoryId === String(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid">
          <Field label="Categoria completa" error={errors.category}>
            {(props) => (
              <select
                {...props}
                value={activeCategoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-label="Categoria"
              >
                <option value="">Selecione...</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Conta" error={errors.account}>
            {(props) => (
              <select
                {...props}
                value={activeAccountId}
                onChange={(e) => setAccountId(e.target.value)}
                aria-label="Conta"
              >
                <option value="">Selecione...</option>
                {availableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="grid">
          <Field label="Data" error={errors.date}>
            {(props) => (
              <input
                {...props}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Data"
              />
            )}
          </Field>

          <Field label="Descrição (opcional)">
            {(props) => (
              <input
                {...props}
                placeholder="Ex: Almoço, Uber, Salário"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="Descrição"
              />
            )}
          </Field>
        </div>

        {type === 'expense' && (
          <details className="form-details">
            <summary>Compra parcelada?</summary>
            <div style={{ marginTop: '8px' }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={installments}
                  onChange={(e) => setInstallments(e.target.checked)}
                />
                Dividir em parcelas mensais
              </label>
              {installments && (
                <Field label="Quantidade de parcelas" error={errors.count}>
                  {(props) => (
                    <input
                      {...props}
                      type="number"
                      min={2}
                      max={48}
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      aria-label="Quantidade de parcelas"
                    />
                  )}
                </Field>
              )}
            </div>
          </details>
        )}

        <FormError message={submitError} />

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar lançamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
