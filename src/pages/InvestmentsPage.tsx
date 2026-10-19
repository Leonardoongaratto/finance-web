import { useState, type FormEvent } from 'react';
import { EntryList } from '../components/EntryList';
import { DatedAmountForm, FormShell, useActionRunner, useSubmit } from '../components/forms';
import { AsyncView, Badge, Card, EmptyState, Field, FormError, PageHeader, Stats } from '../components/ui';
import { useConfirm } from '../components/useConfirm';
import { api } from '../lib/api';
import { formatBRL, formatPercent } from '../lib/format';
import { INVESTMENT_TYPE_LABELS } from '../lib/labels';
import { useResource } from '../lib/useResource';
import { compact, requiredText, type FormErrors } from '../lib/validation';
import type { Investment, InvestmentType } from '../types';

export default function InvestmentsPage() {
  const resource = useResource(api.listInvestments);
  const confirm = useConfirm();
  const { error, run } = useActionRunner(resource.reload);

  return (
    <>
      <PageHeader title="Investimentos" />
      <AsyncView
        resource={resource}
        isEmpty={(items) => items.length === 0}
        empty={
          <EmptyState
            title="Cadastre seu primeiro investimento"
            description="Acompanhe quanto você aportou, quanto vale hoje e o rendimento de cada investimento."
          >
            <InvestmentForm onSaved={resource.reload} />
          </EmptyState>
        }
      >
        {(investments) => (
          <>
            <Summary investments={investments} />
            <Card title="Novo investimento">
              <InvestmentForm onSaved={resource.reload} />
            </Card>
            <FormError message={error} />
            <div className="grid">
              {investments.map((investment) => (
                <InvestmentCard
                  key={investment.id}
                  investment={investment}
                  reload={resource.reload}
                  onDelete={() =>
                    confirm.ask({
                      title: 'Excluir investimento?',
                      message: `${investment.name} e todos os seus aportes e avaliações serão removidos.`,
                      onConfirm: () => run(() => api.deleteInvestment(investment.id)),
                    })
                  }
                  onDeleteEntry={(label, action) =>
                    confirm.ask({
                      title: `Excluir ${label}?`,
                      message: 'Esta ação não pode ser desfeita.',
                      onConfirm: () => run(action),
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
      </AsyncView>
      {confirm.dialog}
    </>
  );
}

function gainText(investment: Pick<Investment, 'gain_cents' | 'return_pct'>): string {
  const sign = investment.gain_cents > 0 ? '+' : '';
  return `${sign}${formatBRL(investment.gain_cents)} (${formatPercent(investment.return_pct)})`;
}

function Summary({ investments }: { investments: Investment[] }) {
  const invested = investments.reduce((sum, i) => sum + i.invested_cents, 0);
  const current = investments.reduce((sum, i) => sum + i.current_cents, 0);
  const gain = current - invested;
  const pct = invested > 0 ? (gain * 100) / invested : 0;
  return (
    <Card title="Resumo">
      <Stats
        items={[
          { label: 'Total aportado', value: formatBRL(invested) },
          { label: 'Valor atual', value: formatBRL(current) },
          {
            label: 'Rendimento',
            value: gainText({ gain_cents: gain, return_pct: Math.round(pct * 100) / 100 }),
            tone: gain < 0 ? 'negative' : 'positive',
          },
        ]}
      />
    </Card>
  );
}

interface InvestmentCardProps {
  investment: Investment;
  reload: () => void;
  onDelete: () => void;
  onDeleteEntry: (label: string, action: () => Promise<unknown>) => void;
}

function InvestmentCard({ investment, reload, onDelete, onDeleteEntry }: InvestmentCardProps) {
  return (
    <section className="card" aria-label={investment.name}>
      <div className="card-title-row">
        <h2>{investment.name}</h2>
        <Badge tone="neutral">{INVESTMENT_TYPE_LABELS[investment.type]}</Badge>
      </div>
      <Stats
        items={[
          { label: 'Aportado', value: formatBRL(investment.invested_cents) },
          { label: 'Valor atual', value: formatBRL(investment.current_cents) },
          {
            label: 'Rendimento',
            value: gainText(investment),
            tone: investment.gain_cents < 0 ? 'negative' : 'positive',
          },
        ]}
      />
      <DatedAmountForm
        submitLabel="Registrar aporte"
        amountLabel="Valor do aporte"
        onSubmit={async (date, cents) => {
          await api.addContribution(investment.id, { date, amount_cents: cents });
          reload();
        }}
      />
      <DatedAmountForm
        submitLabel="Registrar avaliação"
        amountLabel="Valor atual"
        allowZero
        onSubmit={async (date, cents) => {
          await api.addValuation(investment.id, { date, value_cents: cents });
          reload();
        }}
      />
      <EntryList
        title="Aportes"
        itemLabel="aporte"
        entries={investment.contributions.map((c) => ({ id: c.id, date: c.date, cents: c.amount_cents }))}
        onDelete={(entry) => onDeleteEntry('aporte', () => api.deleteContribution(investment.id, entry.id))}
      />
      <EntryList
        title="Avaliações"
        itemLabel="avaliação"
        entries={investment.valuations.map((v) => ({ id: v.id, date: v.date, cents: v.value_cents }))}
        onDelete={(entry) => onDeleteEntry('avaliação', () => api.deleteValuation(investment.id, entry.id))}
      />
      <button
        type="button"
        className="btn btn-danger"
        aria-label={`Excluir investimento ${investment.name}`}
        onClick={onDelete}
      >
        Excluir investimento
      </button>
    </section>
  );
}

function InvestmentForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('fixed_income');
  const [errors, setErrors] = useState<FormErrors>({});
  const { busy, submitError, submit } = useSubmit();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = compact({ name: requiredText(name, 'Informe o nome do investimento.') });
    setErrors(found);
    if (await submit(found, () => api.createInvestment({ name: name.trim(), type }).then(() => undefined))) {
      setName('');
      onSaved();
    }
  }

  return (
    <FormShell
      submitLabel="Salvar investimento"
      busy={busy}
      submitError={submitError}
      onSubmit={handleSubmit}
    >
      <Field label="Nome do investimento" error={errors.name}>
        {(props) => <input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Tipo de investimento">
        {(props) => (
          <select {...props} value={type} onChange={(e) => setType(e.target.value as InvestmentType)}>
            {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>
    </FormShell>
  );
}
