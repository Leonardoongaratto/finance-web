import type { BadgeTone } from '../components/ui';
import type { AccountType, Debt, GoalStatus, InvestmentType } from '../types';
import { formatMonth } from './format';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
};

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  fixed_income: 'Renda fixa',
  stocks: 'Ações',
  reits: 'Fundos imobiliários',
  treasury: 'Tesouro Direto',
  crypto: 'Criptomoedas',
  other: 'Outros',
};

export const GOAL_STATUS: Record<GoalStatus, { label: string; tone: BadgeTone }> = {
  on_track: { label: 'No ritmo', tone: 'success' },
  behind: { label: 'Abaixo do ritmo', tone: 'warning' },
  done: { label: 'Concluída', tone: 'info' },
  overdue: { label: 'Prazo vencido', tone: 'danger' },
};

export function payoffMessage(debt: Debt): string {
  if (debt.paid_off) return 'Quitada';
  if (debt.never_pays_off) return 'Nunca quita: a parcela não cobre os juros do mês';
  const months = debt.payoff_months === 1 ? '1 mês' : `${debt.payoff_months} meses`;
  return `Quita em ${formatMonth(debt.payoff_month ?? '')} (${months})`;
}

export function formatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao mês`;
}
