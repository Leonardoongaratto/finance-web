import { formatBRL, formatDate, todayISO } from '../lib/format';
import { parseBRL } from '../lib/format';

export interface GoalSimulatorProps {
  targetText: string;
  deadlineText: string;
  today?: string;
}

export function calculateGoalPlan(
  targetText: string,
  deadlineText: string,
  today: string = todayISO(),
): {
  valid: boolean;
  cents: number;
  monthsLeft: number;
  monthlyNeededCents: number;
  message?: string;
} {
  const cents = parseBRL(targetText);
  if (cents === null || cents <= 0) {
    return { valid: false, cents: 0, monthsLeft: 0, monthlyNeededCents: 0 };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineText)) {
    return { valid: false, cents, monthsLeft: 0, monthlyNeededCents: 0 };
  }

  const [tYear = 0, tMonth = 1] = today.slice(0, 7).split('-').map(Number);
  const [dYear = 0, dMonth = 1] = deadlineText.slice(0, 7).split('-').map(Number);
  const months = (dYear - tYear) * 12 + (dMonth - tMonth);

  if (months < 0) {
    return {
      valid: false,
      cents,
      monthsLeft: 0,
      monthlyNeededCents: 0,
      message: 'Escolha uma data futura para planejar o investimento.',
    };
  }

  const effectiveMonths = Math.max(months, 1);
  const monthlyNeededCents = Math.ceil(cents / effectiveMonths);

  return {
    valid: true,
    cents,
    monthsLeft: effectiveMonths,
    monthlyNeededCents,
  };
}

export function GoalSimulator({ targetText, deadlineText, today }: GoalSimulatorProps) {
  const plan = calculateGoalPlan(targetText, deadlineText, today);

  if (plan.message) {
    return (
      <div className="goal-simulation-card warning" role="region" aria-label="Simulação do plano">
        <p className="goal-sim-notice">{plan.message}</p>
      </div>
    );
  }

  if (!plan.valid) return null;

  return (
    <div className="goal-simulation-card" role="region" aria-label="Simulação do plano">
      <div className="goal-sim-header">
        <span className="goal-sim-badge" aria-hidden="true">
          🎯 Plano Sugerido
        </span>
        <span className="goal-sim-subtitle">Cálculo em tempo real</span>
      </div>
      <div className="goal-sim-body">
        <div className="goal-sim-metric">
          <span className="goal-sim-label">Você precisa investir por mês:</span>
          <strong
            className="goal-sim-value"
            aria-label={`Investimento mensal de ${formatBRL(plan.monthlyNeededCents)}`}
          >
            {formatBRL(plan.monthlyNeededCents)}
            <small>/mês</small>
          </strong>
        </div>
        <div className="goal-sim-stats">
          <div>
            <span className="muted">Prazo:</span>{' '}
            <strong>
              {plan.monthsLeft} {plan.monthsLeft === 1 ? 'mês' : 'meses'} ({formatDate(deadlineText)})
            </strong>
          </div>
          <div>
            <span className="muted">Meta total:</span> <strong>{formatBRL(plan.cents)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
