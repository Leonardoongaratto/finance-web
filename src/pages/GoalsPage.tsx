import { useState, type FormEvent } from 'react';
import { ContributeModal } from '../components/ContributeModal';
import { EntryList } from '../components/EntryList';
import { DatedAmountForm, FormShell, useActionRunner, useSubmit } from '../components/forms';
import { GoalModal } from '../components/GoalModal';
import { GoalSimulator } from '../components/GoalSimulator';
import {
  AsyncView,
  Badge,
  EmptyState,
  Field,
  FormError,
  PageHeader,
  ProgressBar,
  Stats,
} from '../components/ui';
import { useConfirm } from '../components/useConfirm';
import { api } from '../lib/api';
import { formatBRL, formatDate, todayISO } from '../lib/format';
import { GOAL_STATUS } from '../lib/labels';
import { useResource } from '../lib/useResource';
import { compact, requiredText, validAmount, validDate, type FormErrors } from '../lib/validation';
import type { Goal } from '../types';

export default function GoalsPage() {
  const resource = useResource(api.listGoals);
  const confirm = useConfirm();
  const { error, run } = useActionRunner(resource.reload);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);

  return (
    <>
      <div className="card-title-row" style={{ marginBottom: '16px' }}>
        <PageHeader title="Metas" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowGoalModal(true)}
          aria-label="Abrir formulário de nova meta"
        >
          + Nova Meta
        </button>
      </div>

      <AsyncView
        resource={resource}
        isEmpty={(goals) => goals.length === 0}
        empty={
          <EmptyState
            title="Cadastre sua primeira meta"
            description="Defina quanto quer guardar e até quando. Mostramos quanto falta e quanto guardar por mês."
          >
            <GoalForm onSaved={resource.reload} />
          </EmptyState>
        }
      >
        {(goals) => (
          <>
            <FormError message={error} />
            <div className="grid">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  reload={resource.reload}
                  onOpenContribute={() => setContributeGoal(goal)}
                  onDelete={() =>
                    confirm.ask({
                      title: 'Excluir meta?',
                      message: `A meta ${goal.name} e seus aportes serão removidos.`,
                      onConfirm: () => run(() => api.deleteGoal(goal.id)),
                    })
                  }
                  onDeleteContribution={(contributionId) =>
                    confirm.ask({
                      title: 'Excluir aporte?',
                      message: 'Esta ação não pode ser desfeita.',
                      onConfirm: () => run(() => api.deleteGoalContribution(goal.id, contributionId)),
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
      </AsyncView>

      <GoalModal isOpen={showGoalModal} onClose={() => setShowGoalModal(false)} onSaved={resource.reload} />

      <ContributeModal
        goal={contributeGoal}
        isOpen={contributeGoal !== null}
        onClose={() => setContributeGoal(null)}
        onSaved={resource.reload}
      />

      {confirm.dialog}
    </>
  );
}

interface GoalCardProps {
  goal: Goal;
  reload: () => void;
  onOpenContribute: () => void;
  onDelete: () => void;
  onDeleteContribution: (id: number) => void;
}

function GoalCard({ goal, reload, onOpenContribute, onDelete, onDeleteContribution }: GoalCardProps) {
  const status = GOAL_STATUS[goal.status];
  const done = goal.status === 'done';

  return (
    <section className="card" aria-label={goal.name}>
      <div className="card-title-row">
        <h2>{goal.name}</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <ProgressBar value={goal.progress_pct} label={`Progresso de ${goal.name}`} />

      <p>
        <strong>{goal.progress_pct}%</strong> · {formatBRL(goal.saved_cents)} de{' '}
        {formatBRL(goal.target_cents)}
      </p>

      {!done && (
        <div className="goal-monthly-highlight">
          <span className="goal-monthly-title">🎯 Investir por mês:</span>
          <strong className="goal-monthly-amount">{formatBRL(goal.monthly_needed_cents)}</strong>
        </div>
      )}

      <Stats
        items={[
          { label: 'Prazo', value: formatDate(goal.deadline) },
          { label: 'Faltam', value: formatBRL(goal.remaining_cents) },
          {
            label: done ? 'Situação' : 'Meses restantes',
            value: done ? 'Meta atingida' : `${goal.months_left} meses`,
          },
        ]}
      />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!done && (
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={onOpenContribute}
            aria-label={`Guardar dinheiro na meta ${goal.name}`}
          >
            💰 + Guardar
          </button>
        )}
      </div>

      <details className="form-details">
        <summary>Registrar aporte rápido</summary>
        <div style={{ marginTop: '8px' }}>
          <DatedAmountForm
            submitLabel="Registrar aporte"
            amountLabel="Valor do aporte"
            onSubmit={async (date, cents) => {
              await api.addGoalContribution(goal.id, { date, amount_cents: cents });
              reload();
            }}
          />
        </div>
      </details>

      <EntryList
        title="Aportes"
        itemLabel="aporte"
        entries={goal.contributions.map((c) => ({ id: c.id, date: c.date, cents: c.amount_cents }))}
        onDelete={(entry) => onDeleteContribution(entry.id)}
      />

      <button
        type="button"
        className="btn btn-danger"
        aria-label={`Excluir meta ${goal.name}`}
        onClick={onDelete}
      >
        Excluir meta
      </button>
    </section>
  );
}

function GoalForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState(() => todayISO());
  const [errors, setErrors] = useState<FormErrors>({});
  const { busy, submitError, submit } = useSubmit();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = validAmount(target);
    const found = compact({
      name: requiredText(name, 'Informe o nome da meta.'),
      target: amount.error,
      deadline: validDate(deadline),
    });
    setErrors(found);
    const saved = await submit(found, () =>
      api.createGoal({ name: name.trim(), target_cents: amount.cents ?? 0, deadline }).then(() => undefined),
    );
    if (saved) {
      setName('');
      setTarget('');
      onSaved();
    }
  }

  return (
    <FormShell submitLabel="Salvar meta" busy={busy} submitError={submitError} onSubmit={handleSubmit}>
      <Field label="Nome da meta" error={errors.name}>
        {(props) => <input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Valor-alvo" error={errors.target}>
        {(props) => (
          <input
            {...props}
            inputMode="decimal"
            placeholder="0,00"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        )}
      </Field>
      <Field label="Prazo" error={errors.deadline}>
        {(props) => (
          <input {...props} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        )}
      </Field>

      <GoalSimulator targetText={target} deadlineText={deadline} />
    </FormShell>
  );
}
