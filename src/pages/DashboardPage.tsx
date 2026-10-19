import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CashflowChart,
  CategoryChart,
  DebtChart,
  GoalsChart,
  InvestmentChart,
  NetWorthChart,
  Sparkline,
} from '../components/charts';
import { ContributeModal } from '../components/ContributeModal';
import { GoalModal } from '../components/GoalModal';
import { AsyncView, Card, EmptyState, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { formatBRL, formatDate, periodRange, type Period } from '../lib/format';
import { paletteFor } from '../lib/palette';
import { useTheme } from '../lib/theme';
import { useResource } from '../lib/useResource';
import type { Dashboard, DebtSeries, Goal, Kpis, Transaction } from '../types';

const PERIODS: { value: Period; label: string; short: string; scope: string }[] = [
  { value: '3m', label: '3 meses', short: '3m', scope: 'últimos 3 meses' },
  { value: '6m', label: '6 meses', short: '6m', scope: 'últimos 6 meses' },
  { value: '12m', label: '12 meses', short: '12m', scope: 'últimos 12 meses' },
  { value: 'all', label: 'Tudo', short: 'Tudo', scope: 'todo o histórico' },
];

export function isDashboardEmpty(d: Dashboard): boolean {
  const noBalances = d.net_worth.every(
    (p) => p.accounts_cents === 0 && p.investments_cents === 0 && p.debts_cents === 0,
  );
  const noFlow = d.cashflow.every((p) => p.income_cents === 0 && p.expense_cents === 0);
  return noBalances && noFlow && d.goals.length === 0 && d.debts.length === 0;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('12m');
  const loader = useCallback(() => api.getDashboard(periodRange(period)), [period]);
  const resource = useResource(loader);
  const scopeLabel = PERIODS.find((p) => p.value === period)?.scope ?? '';
  const { reload } = resource;

  useEffect(() => {
    window.addEventListener('finance-reload', reload);
    return () => window.removeEventListener('finance-reload', reload);
  }, [reload]);

  return (
    <>
      <PageHeader title="Painel">
        <div className="segmented" role="group" aria-label="Período">
          {PERIODS.map(({ value, label, short }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              <span className="label-long">{label}</span>
              <span className="label-short" aria-hidden="true">
                {short}
              </span>
            </button>
          ))}
        </div>
      </PageHeader>
      <div aria-busy={resource.loading}>
        <AsyncView
          resource={resource}
          isEmpty={isDashboardEmpty}
          empty={
            <EmptyState
              title="Comece pelo primeiro cadastro"
              description="Cadastre uma conta e seus lançamentos, um investimento, uma meta ou uma dívida para ver a evolução aqui."
            >
              <div className="form-actions">
                <Link className="btn btn-primary" to="/transacoes">
                  Cadastrar conta e transações
                </Link>
                <Link className="btn" to="/investimentos">
                  Investimentos
                </Link>
                <Link className="btn" to="/metas">
                  Metas
                </Link>
                <Link className="btn" to="/dividas">
                  Dívidas
                </Link>
              </div>
            </EmptyState>
          }
        >
          {(dashboard) => (
            <DashboardContent dashboard={dashboard} scopeLabel={scopeLabel} onReload={resource.reload} />
          )}
        </AsyncView>
      </div>
    </>
  );
}

function DashboardContent({
  dashboard,
  scopeLabel,
  onReload,
}: {
  dashboard: Dashboard;
  scopeLabel: string;
  onReload: () => void;
}) {
  const palette = paletteFor(useTheme().theme);
  const { kpis } = dashboard;
  const months = dashboard.cashflow.map((p) => p.month);

  const [detailedGoals, setDetailedGoals] = useState<Goal[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);

  const loadLists = useCallback(() => {
    void api
      .listGoals()
      .then(setDetailedGoals)
      .catch(() => {});
    void api
      .listTransactions()
      .then(setRecentTransactions)
      .catch(() => {});
  }, []);

  const reloadAll = useCallback(() => {
    loadLists();
    onReload();
  }, [loadLists, onReload]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    window.addEventListener('finance-reload', loadLists);
    return () => window.removeEventListener('finance-reload', loadLists);
  }, [loadLists]);

  const cards = [
    {
      label: 'Patrimônio líquido',
      value: kpis.net_worth_cents,
      values: dashboard.net_worth.map((p) => p.net_worth_cents),
    },
    {
      label: 'Gasto do mês',
      value: kpis.month_expenses_cents,
      values: dashboard.cashflow.map((p) => p.expense_cents),
    },
    {
      label: 'Total investido',
      value: kpis.invested_cents,
      values: dashboard.investments.map((p) => p.invested_cents),
    },
    {
      label: 'Dívida total',
      value: kpis.total_debt_cents,
      values: dashboard.net_worth.map((p) => p.debts_cents),
    },
  ];

  return (
    <>
      <div className="grid-kpi">
        {cards.map((card) => (
          <section key={card.label} className="card" aria-label={card.label}>
            <span className="kpi-label">{card.label}</span>
            <strong className="kpi-value">{formatBRL(card.value)}</strong>
            <Sparkline
              values={card.values}
              color={palette.textSecondary}
              label={`Tendência: ${card.label}`}
            />
          </section>
        ))}
      </div>

      <div className="chart-scope">
        <strong>{`Gráficos: ${scopeLabel}`}</strong>
        <p className="muted">Os cartões de topo não mudam com o período; ele vale só para os gráficos.</p>
      </div>
      <div className="grid-charts" style={{ marginBottom: '16px' }}>
        <Card title="Evolução do patrimônio líquido">
          <NetWorthChart points={dashboard.net_worth} />
        </Card>
        <Card title="Entradas e saídas por mês">
          <CashflowChart points={dashboard.cashflow} />
        </Card>
      </div>
      <details className="form-details" style={{ marginBottom: '16px' }}>
        <summary>Mais gráficos</summary>
        <div className="grid-charts" style={{ marginTop: '16px' }}>
          <Card title="Gastos por categoria">
            <CategoryChart points={dashboard.spending_by_category} months={months} />
          </Card>
          <Card title="Saldo devedor e projeção">
            <DebtChart debts={dashboard.debts} />
          </Card>
          <Card title="Investimentos: aportado e valor atual">
            <InvestmentChart points={dashboard.investments} />
          </Card>
          <Card title="Metas: acumulado e ritmo ideal">
            <GoalsChart goals={dashboard.goals} />
          </Card>
        </div>
      </details>

      <section className="card" aria-label="Resumo de Metas Ativas" style={{ marginBottom: '16px' }}>
        <div className="card-title-row">
          <h3>🎯 Minhas Metas</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => setShowGoalModal(true)}
              aria-label="Nova Meta"
            >
              + Nova Meta
            </button>
            <Link to="/metas" className="btn btn-small">
              Ver todas as metas →
            </Link>
          </div>
        </div>

        {dashboard.goals.length === 0 && detailedGoals.length === 0 ? (
          <p className="muted" style={{ marginTop: '12px' }}>
            Nenhuma meta cadastrada ainda. Crie sua primeira meta para acompanhar o progresso!
          </p>
        ) : (
          <div className="grid" style={{ marginTop: '12px' }}>
            {detailedGoals.length > 0
              ? detailedGoals.slice(0, 3).map((g) => (
                  <div
                    key={g.id}
                    className="goal-monthly-highlight"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <strong>{g.name}</strong>
                      <span className="muted">{g.progress_pct}%</span>
                    </div>
                    <span className="muted" style={{ fontSize: '0.8125rem' }}>
                      Progresso:{' '}
                      <strong style={{ color: 'var(--text-accent)' }}>
                        {formatBRL(g.saved_cents)} de {formatBRL(g.target_cents)}
                      </strong>
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        marginTop: '4px',
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem' }}>
                        🎯 Investir por mês:{' '}
                        <strong style={{ color: 'var(--text-accent)' }}>
                          {formatBRL(g.monthly_needed_cents)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => setContributeGoal(g)}
                        aria-label={`Guardar dinheiro na meta ${g.name}`}
                      >
                        💰 + Guardar
                      </button>
                    </div>
                  </div>
                ))
              : dashboard.goals.slice(0, 3).map((g) => {
                  const latest = g.series[g.series.length - 1];
                  const saved = latest ? latest.saved_cents : 0;
                  const pct =
                    g.target_cents > 0 ? Math.min(100, Math.round((saved / g.target_cents) * 100)) : 0;
                  return (
                    <div
                      key={g.id}
                      className="goal-monthly-highlight"
                      style={{ flexDirection: 'column', alignItems: 'flex-start' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <strong>{g.name}</strong>
                        <span className="muted">{pct}%</span>
                      </div>
                      <span className="muted" style={{ fontSize: '0.8125rem' }}>
                        Progresso:{' '}
                        <strong style={{ color: 'var(--text-accent)' }}>
                          {formatBRL(saved)} de {formatBRL(g.target_cents)}
                        </strong>
                      </span>
                    </div>
                  );
                })}
          </div>
        )}
      </section>

      <NetWorthWidget kpis={kpis} debts={dashboard.debts} />

      <section className="card" aria-label="Lançamentos Recentes" style={{ marginBottom: '16px' }}>
        <div className="card-title-row">
          <h3>📋 Lançamentos Recentes</h3>
          <Link to="/transacoes" className="btn btn-small">
            Ver extrato completo →
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="muted" style={{ marginTop: '12px' }}>
            Nenhum lançamento recente. Use o botão <strong>+ Lançar</strong> no canto da tela para registrar
            gastos e receitas.
          </p>
        ) : (
          <ul className="list" style={{ marginTop: '12px' }} aria-label="Lançamentos recentes">
            {recentTransactions.slice(0, 5).map((t) => (
              <li key={t.id} className="list-row">
                <div className="grow">
                  <div>{t.description || 'Lançamento'}</div>
                  <div className="muted">{formatDate(t.date)}</div>
                </div>
                <strong className={t.type === 'income' ? 'positive' : 'negative'}>
                  {t.type === 'income' ? '+' : '-'}
                  {formatBRL(t.amount_cents)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GoalModal isOpen={showGoalModal} onClose={() => setShowGoalModal(false)} onSaved={reloadAll} />

      <ContributeModal
        isOpen={Boolean(contributeGoal)}
        goal={contributeGoal}
        onClose={() => setContributeGoal(null)}
        onSaved={reloadAll}
      />
    </>
  );
}

function NetWorthWidget({ kpis, debts }: { kpis: Kpis; debts: DebtSeries[] }) {
  const openDebts = debts.filter((d) => !d.not_started && d.balance_cents > 0);
  const hasData = kpis.invested_cents !== 0 || openDebts.length > 0;

  return (
    <section className="card" aria-label="Patrimônio" style={{ marginBottom: '16px' }}>
      <div className="card-title-row">
        <h3>💰 Patrimônio</h3>
      </div>

      {hasData ? (
        <div className="grid" style={{ marginTop: '12px' }}>
          <div>
            <span className="muted">Investido</span>
            <div>
              <strong>{formatBRL(kpis.invested_cents)}</strong>
            </div>
            <Link to="/investimentos" className="btn btn-small" style={{ marginTop: '8px' }}>
              Ver investimentos →
            </Link>
          </div>
          <div>
            <span className="muted">Dívidas</span>
            <div>
              <strong>{formatBRL(kpis.total_debt_cents)}</strong>{' '}
              <span className="muted">({openDebts.length} em aberto)</span>
            </div>
            <Link to="/dividas" className="btn btn-small" style={{ marginTop: '8px' }}>
              Ver dívidas →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: '12px' }}>
            Nenhum valor investido nem dívida em aberto ainda. Cadastre investimentos ou dívidas para
            acompanhar seu patrimônio aqui.
          </p>
          <div className="form-actions">
            <Link to="/investimentos" className="btn btn-small">
              Ver investimentos →
            </Link>
            <Link to="/dividas" className="btn btn-small">
              Ver dívidas →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
