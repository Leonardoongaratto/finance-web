import { useId, type ReactNode } from 'react';
import type { Resource } from '../lib/useResource';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <p className="muted">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="state state-box" role="alert">
      <p>{error.message}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="state state-box" aria-label={title}>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {children}
    </section>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? errorId : undefined })}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Stats({
  items,
}: {
  items: { label: string; value: ReactNode; tone?: 'positive' | 'negative' }[];
}) {
  return (
    <dl className="stats">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.tone}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="banner banner-error" role="alert">
      {message}
    </div>
  );
}

interface AsyncViewProps<T> {
  resource: Resource<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

export function AsyncView<T>({ resource, isEmpty, empty, children }: AsyncViewProps<T>) {
  if (resource.error) return <ErrorState error={resource.error} onRetry={resource.reload} />;
  if (resource.data === undefined) return <Loading />;
  if (isEmpty?.(resource.data)) return <>{empty}</>;
  return <>{children(resource.data)}</>;
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  extraLabel?: string;
  onConfirm: () => void;
  onExtra?: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Excluir',
  extraLabel,
  onConfirm,
  onExtra,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <div className="dialog-overlay">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          {extraLabel && onExtra && (
            <button type="button" className="btn btn-danger" onClick={onExtra}>
              {extraLabel}
            </button>
          )}
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
