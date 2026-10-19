import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { todayISO } from '../lib/format';
import {
  compact,
  requiredText,
  validAmount,
  validDate,
  validRatePercent,
  type FormErrors,
} from '../lib/validation';
import { FormShell, useSubmit } from './forms';
import { Modal } from './Modal';
import { Field } from './ui';

export function DebtForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [creditor, setCreditor] = useState('');
  const [original, setOriginal] = useState('');
  const [rate, setRate] = useState('');
  const [payment, setPayment] = useState('');
  const [startDate, setStartDate] = useState(() => todayISO());
  const [errors, setErrors] = useState<FormErrors>({});
  const { busy, submitError, submit } = useSubmit();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const originalAmount = validAmount(original);
    const rateResult = validRatePercent(rate);
    const paymentAmount = payment.trim() === '' ? { cents: 0 } : validAmount(payment, { allowZero: true });
    const found = compact({
      name: requiredText(name, 'Informe o nome da dívida.'),
      original: originalAmount.error,
      rate: rateResult.error,
      payment: paymentAmount.error,
      startDate: validDate(startDate),
    });
    setErrors(found);
    const saved = await submit(found, () =>
      api
        .createDebt({
          name: name.trim(),
          creditor: creditor.trim(),
          original_cents: originalAmount.cents ?? 0,
          monthly_rate_bp: rateResult.bp ?? 0,
          monthly_payment_cents: paymentAmount.cents ?? 0,
          start_date: startDate,
        })
        .then(() => undefined),
    );
    if (saved) {
      setName('');
      setCreditor('');
      setOriginal('');
      setRate('');
      setPayment('');
      onSaved();
    }
  }

  return (
    <FormShell submitLabel="Salvar dívida" busy={busy} submitError={submitError} onSubmit={handleSubmit}>
      <Field label="Nome da dívida" error={errors.name}>
        {(props) => <input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Credor">
        {(props) => <input {...props} value={creditor} onChange={(e) => setCreditor(e.target.value)} />}
      </Field>
      <Field label="Valor original" error={errors.original}>
        {(props) => (
          <input
            {...props}
            inputMode="decimal"
            placeholder="0,00"
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
          />
        )}
      </Field>
      <Field label="Juros ao mês (%)" error={errors.rate}>
        {(props) => (
          <input
            {...props}
            inputMode="decimal"
            placeholder="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        )}
      </Field>
      <Field label="Parcela mensal" error={errors.payment}>
        {(props) => (
          <input
            {...props}
            inputMode="decimal"
            placeholder="0,00"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          />
        )}
      </Field>
      <Field label="Data de início" error={errors.startDate}>
        {(props) => (
          <input {...props} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        )}
      </Field>
    </FormShell>
  );
}

export interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function DebtModal({ isOpen, onClose, onSaved }: DebtModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova dívida">
      <DebtForm
        onSaved={() => {
          onSaved();
          onClose();
        }}
      />
    </Modal>
  );
}
