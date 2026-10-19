import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ui';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  extraLabel?: string;
  onExtra?: () => void | Promise<void>;
}

/** Confirmation before destructive actions: call `ask(...)` and render `dialog` once in the page. */
export function useConfirm(): { ask: (request: ConfirmRequest) => void; dialog: ReactNode } {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const close = useCallback(() => setRequest(null), []);

  const run = (action: (() => void | Promise<void>) | undefined) => () => {
    close();
    void action?.();
  };

  const dialog = request && (
    <ConfirmDialog
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      extraLabel={request.extraLabel}
      onConfirm={run(request.onConfirm)}
      onExtra={run(request.onExtra)}
      onCancel={close}
    />
  );
  return { ask: setRequest, dialog };
}
