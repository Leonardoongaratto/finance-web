import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { todayISO } from '../lib/format';
import { compact, requiredText, validAmount, validDate, type FormErrors } from '../lib/validation';
import { CurrencyInput } from './CurrencyInput';
import { GoalSimulator } from './GoalSimulator';
import { Modal } from './Modal';
import { Field, FormError } from './ui';

export interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function GoalModal({ isOpen, onClose, onSaved }: GoalModalProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState(() => todayISO());
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  function reset() {
    setName('');
    setTarget('');
    setDeadline(todayISO());
    setErrors({});
    setSubmitError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = validAmount(target);
    const found = compact({
      name: requiredText(name, 'Informe o nome da meta.'),
      target: amount.error,
      deadline: validDate(deadline),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSubmitError(undefined);
    try {
      await api.createGoal({
        name: name.trim(),
        target_cents: amount.cents ?? 0,
        deadline,
      });
      reset();
      onSaved();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível salvar a meta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Meta Financeira">
      <form onSubmit={handleSubmit} noValidate className="form">
        <Field label="Nome da meta" error={errors.name}>
          {(props) => (
            <input
              {...props}
              placeholder="Ex: Reserva de Emergência, Carro Novo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          )}
        </Field>

        <Field label="Valor-alvo" error={errors.target}>
          {(props) => (
            <CurrencyInput
              {...props}
              value={target}
              onChange={setTarget}
              placeholder="0,00"
              aria-label="Valor-alvo"
            />
          )}
        </Field>

        <Field label="Prazo" error={errors.deadline}>
          {(props) => (
            <input
              {...props}
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              aria-label="Prazo"
            />
          )}
        </Field>

        <GoalSimulator targetText={target} deadlineText={deadline} />

        <FormError message={submitError} />

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar meta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
