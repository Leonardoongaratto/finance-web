import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { formatBRL, todayISO } from '../lib/format';
import { compact, validAmount, validDate, type FormErrors } from '../lib/validation';
import type { Goal } from '../types';
import { CurrencyInput } from './CurrencyInput';
import { FormError } from './ui';
import { Modal } from './Modal';

export interface ContributeModalProps {
  goal: Goal | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ContributeModal({ goal, isOpen, onClose, onSaved }: ContributeModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => todayISO());
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  if (!goal) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal) return;
    const parsedAmount = validAmount(amount);
    const found = compact({
      amount: parsedAmount.error,
      date: validDate(date),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSubmitError(undefined);
    try {
      await api.addGoalContribution(goal.id, {
        date,
        amount_cents: parsedAmount.cents ?? 0,
      });
      setAmount('');
      onSaved();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível salvar o aporte.');
    } finally {
      setBusy(false);
    }
  }

  function handleSetMonthly() {
    if (goal && goal.monthly_needed_cents > 0) {
      const formatted = (goal.monthly_needed_cents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setAmount(formatted);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Guardar na meta: ${goal.name}`}>
      <form onSubmit={handleSubmit} noValidate className="form">
        <p className="muted" style={{ margin: 0 }}>
          Meta: <strong>{formatBRL(goal.target_cents)}</strong> · Faltam:{' '}
          <strong>{formatBRL(goal.remaining_cents)}</strong>
        </p>

        {goal.monthly_needed_cents > 0 && goal.status !== 'done' && (
          <div className="quick-amount-suggestion">
            <span className="muted">Meta deste mês:</span>
            <button
              type="button"
              className="chip-btn"
              onClick={handleSetMonthly}
              aria-label={`Usar valor do mês: ${formatBRL(goal.monthly_needed_cents)}`}
            >
              Usar {formatBRL(goal.monthly_needed_cents)}
            </button>
          </div>
        )}

        <div className="field">
          <label htmlFor="contribute-amount">Valor do aporte</label>
          <CurrencyInput
            id="contribute-amount"
            value={amount}
            onChange={setAmount}
            autoFocus
            aria-label="Valor do aporte"
          />
          {errors.amount && <span className="field-error">{errors.amount}</span>}
        </div>

        <div className="field">
          <label htmlFor="contribute-date">Data do aporte</label>
          <input id="contribute-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {errors.date && <span className="field-error">{errors.date}</span>}
        </div>

        <FormError message={submitError} />

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Salvando...' : 'Confirmar aporte'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
