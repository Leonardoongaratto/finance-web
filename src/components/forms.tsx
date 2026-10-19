import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { todayISO } from '../lib/format';
import { compact, hasErrors, validAmount, validDate, type FormErrors } from '../lib/validation';
import { FormError, Field } from './ui';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível salvar.';
}

interface FormShellProps {
  submitLabel: string;
  busy: boolean;
  submitError?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

export function FormShell({ submitLabel, busy, submitError, onSubmit, children }: FormShellProps) {
  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {children}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {submitLabel}
        </button>
        <FormError message={submitError} />
      </div>
    </form>
  );
}

/** Wraps submit handling: validation errors stay inline, API failures show as a banner. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  async function submit(errors: FormErrors, action: () => Promise<void>): Promise<boolean> {
    if (hasErrors(errors)) return false;
    setBusy(true);
    setSubmitError(undefined);
    try {
      await action();
      return true;
    } catch (error) {
      setSubmitError(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, submitError, submit };
}

/** Runs a mutation, reloads the page data on success and exposes the failure message. */
export function useActionRunner(reload: () => void) {
  const [error, setError] = useState<string>();
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(undefined);
      try {
        await action();
        reload();
      } catch (failure) {
        setError(errorMessage(failure));
      }
    },
    [reload],
  );
  return { error, run };
}

interface DatedAmountFormProps {
  submitLabel: string;
  amountLabel: string;
  allowZero?: boolean;
  onSubmit: (date: string, cents: number) => Promise<void>;
}

export function DatedAmountForm({
  submitLabel,
  amountLabel,
  allowZero = false,
  onSubmit,
}: DatedAmountFormProps) {
  const [date, setDate] = useState(() => todayISO());
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { busy, submitError, submit } = useSubmit();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validAmount(amount, { allowZero });
    const found = compact({ date: validDate(date), amount: parsed.error });
    setErrors(found);
    const saved = await submit(found, () => onSubmit(date, parsed.cents ?? 0));
    if (saved) setAmount('');
  }

  return (
    <FormShell submitLabel={submitLabel} busy={busy} submitError={submitError} onSubmit={handleSubmit}>
      <Field label="Data" error={errors.date}>
        {(props) => <input {...props} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      </Field>
      <Field label={amountLabel} error={errors.amount}>
        {(props) => (
          <input
            {...props}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
      </Field>
    </FormShell>
  );
}
