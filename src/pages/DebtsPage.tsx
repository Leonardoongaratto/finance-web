import { useState } from 'react';
import { DebtForm, DebtModal } from '../components/DebtModal';
import { DebtPaymentModal } from '../components/DebtPaymentModal';
import { EntryList } from '../components/EntryList';
import { useActionRunner } from '../components/forms';
import { AsyncView, Badge, Card, EmptyState, FormError, PageHeader, Stats } from '../components/ui';
import { useConfirm } from '../components/useConfirm';
import { api } from '../lib/api';
import { formatBRL, formatMonth } from '../lib/format';
import { formatRate, payoffMessage } from '../lib/labels';
import { useResource } from '../lib/useResource';
import type { Debt } from '../types';

export default function DebtsPage() {
  const resource = useResource(api.listDebts);
  const confirm = useConfirm();
  const { error, run } = useActionRunner(resource.reload);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);

  return (
    <>
      <PageHeader title="Dívidas">
        {!resource.error && (resource.data?.length ?? 0) > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => setShowDebtModal(true)}>
            + Nova dívida
          </button>
        )}
      </PageHeader>
      <AsyncView
        resource={resource}
        isEmpty={(debts) => debts.length === 0}
        empty={
          <EmptyState
            title="Cadastre sua primeira dívida"
            description="Registre o que você deve para ver o saldo atual e quando fica livre dela."
          >
            <DebtForm onSaved={resource.reload} />
          </EmptyState>
        }
      >
        {(debts) => (
          <>
            <Card title="Resumo">
              <Stats items={summaryItems(debts)} />
            </Card>
            <FormError message={error} />
            <div className="grid">
              {debts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  onAddPayment={() => setPaymentDebt(debt)}
                  onDelete={() =>
                    confirm.ask({
                      title: 'Excluir dívida?',
                      message: `A dívida ${debt.name} e seus pagamentos serão removidos.`,
                      onConfirm: () => run(() => api.deleteDebt(debt.id)),
                    })
                  }
                  onDeletePayment={(paymentId) =>
                    confirm.ask({
                      title: 'Excluir pagamento?',
                      message: 'Esta ação não pode ser desfeita.',
                      onConfirm: () => run(() => api.deletePayment(debt.id, paymentId)),
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
      </AsyncView>
      <DebtModal isOpen={showDebtModal} onClose={() => setShowDebtModal(false)} onSaved={resource.reload} />
      <DebtPaymentModal
        debt={paymentDebt}
        onClose={() => setPaymentDebt(null)}
        onSaved={() => {
          resource.reload();
          setPaymentDebt(null);
        }}
      />
      {confirm.dialog}
    </>
  );
}

function sumBalances(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.balance_cents, 0);
}

function summaryItems(debts: Debt[]) {
  const upcoming = debts.filter((d) => d.not_started);
  const items: { label: string; value: string; tone?: 'negative' }[] = [
    {
      label: 'Dívida total',
      value: formatBRL(sumBalances(debts.filter((d) => !d.not_started))),
      tone: 'negative',
    },
    {
      label: 'Dívidas em aberto',
      value: String(debts.filter((d) => !d.paid_off && !d.not_started).length),
    },
  ];
  if (upcoming.length > 0) items.push({ label: 'A iniciar', value: formatBRL(sumBalances(upcoming)) });
  return items;
}

interface DebtCardProps {
  debt: Debt;
  onAddPayment: () => void;
  onDelete: () => void;
  onDeletePayment: (id: number) => void;
}

function DebtCard({ debt, onAddPayment, onDelete, onDeletePayment }: DebtCardProps) {
  const tone = debt.paid_off ? 'success' : debt.never_pays_off ? 'danger' : 'info';
  return (
    <section className="card" aria-label={debt.name}>
      <div className="card-title-row">
        <h2>{debt.name}</h2>
        {debt.creditor && <span className="muted">{debt.creditor}</span>}
      </div>
      <Badge tone={tone}>{payoffMessage(debt)}</Badge>
      {debt.not_started && <Badge tone="warning">Começa em {formatMonth(debt.start_date.slice(0, 7))}</Badge>}
      <Stats
        items={[
          {
            label: 'Saldo devedor',
            value: formatBRL(debt.balance_cents),
            tone: debt.balance_cents > 0 ? 'negative' : 'positive',
          },
          { label: 'Valor original', value: formatBRL(debt.original_cents) },
          { label: 'Juros', value: formatRate(debt.monthly_rate_bp) },
          { label: 'Parcela mensal', value: formatBRL(debt.monthly_payment_cents) },
        ]}
      />
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={onAddPayment}>
          + Pagamento
        </button>
      </div>
      <EntryList
        title="Pagamentos"
        itemLabel="pagamento"
        entries={debt.payments.map((p) => ({ id: p.id, date: p.date, cents: p.amount_cents }))}
        onDelete={(entry) => onDeletePayment(entry.id)}
      />
      <button
        type="button"
        className="btn btn-danger"
        aria-label={`Excluir dívida ${debt.name}`}
        onClick={onDelete}
      >
        Excluir dívida
      </button>
    </section>
  );
}
