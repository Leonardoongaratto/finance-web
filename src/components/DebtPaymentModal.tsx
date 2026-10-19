import { api } from '../lib/api';
import type { Debt } from '../types';
import { DatedAmountForm } from './forms';
import { Modal } from './Modal';

export interface DebtPaymentModalProps {
  debt: Debt | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DebtPaymentModal({ debt, onClose, onSaved }: DebtPaymentModalProps) {
  return (
    <Modal isOpen={debt !== null} onClose={onClose} title={debt ? `Pagamento: ${debt.name}` : ''}>
      {debt && (
        <DatedAmountForm
          submitLabel="Registrar pagamento"
          amountLabel="Valor do pagamento"
          onSubmit={async (date, cents) => {
            await api.addPayment(debt.id, { date, amount_cents: cents });
            onSaved();
          }}
        />
      )}
    </Modal>
  );
}
