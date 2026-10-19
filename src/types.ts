export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card';
export type TransactionType = 'income' | 'expense';
export type InvestmentType = 'fixed_income' | 'stocks' | 'reits' | 'treasury' | 'crypto' | 'other';
export type GoalStatus = 'on_track' | 'behind' | 'done' | 'overdue';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
}

export interface Category {
  id: number;
  name: string;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount_cents: number;
  date: string;
  account_id: number;
  category_id: number;
  description: string;
  installment_group?: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount_cents: number;
  date: string;
  account_id: number;
  category_id: number;
  description: string;
}

export interface InstallmentInput {
  total_cents: number;
  installments: number;
  first_date: string;
  account_id: number;
  category_id: number;
  description: string;
}

export interface DatedAmount {
  id: number;
  date: string;
  amount_cents: number;
}

export interface Valuation {
  id: number;
  date: string;
  value_cents: number;
}

export interface Investment {
  id: number;
  name: string;
  type: InvestmentType;
  invested_cents: number;
  current_cents: number;
  gain_cents: number;
  return_pct: number;
  contributions: DatedAmount[];
  valuations: Valuation[];
}

export interface Goal {
  id: number;
  name: string;
  target_cents: number;
  deadline: string;
  start_date: string;
  saved_cents: number;
  progress_pct: number;
  remaining_cents: number;
  months_left: number;
  monthly_needed_cents: number;
  status: GoalStatus;
  contributions: DatedAmount[];
}

export interface GoalInput {
  name: string;
  target_cents: number;
  deadline: string;
}

export interface Debt {
  id: number;
  name: string;
  creditor: string;
  original_cents: number;
  monthly_rate_bp: number;
  monthly_payment_cents: number;
  start_date: string;
  payments: DatedAmount[];
  balance_cents: number;
  paid_off: boolean;
  never_pays_off: boolean;
  payoff_month?: string;
  payoff_months: number;
  not_started: boolean;
}

export interface DebtInput {
  name: string;
  creditor: string;
  original_cents: number;
  monthly_rate_bp: number;
  monthly_payment_cents: number;
  start_date: string;
}

export interface MonthBalance {
  month: string;
  balance_cents: number;
}

export interface Kpis {
  net_worth_cents: number;
  month_expenses_cents: number;
  invested_cents: number;
  investments_value_cents: number;
  total_debt_cents: number;
}

export interface NetWorthPoint {
  month: string;
  accounts_cents: number;
  investments_cents: number;
  debts_cents: number;
  net_worth_cents: number;
}

export interface CashflowPoint {
  month: string;
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
}

export interface SpendingPoint {
  month: string;
  category_id: number;
  category: string;
  amount_cents: number;
}

export interface InvestmentPoint {
  month: string;
  invested_cents: number;
  current_cents: number;
}

export interface DebtSeries {
  id: number;
  name: string;
  balance_cents: number;
  never_pays_off: boolean;
  not_started: boolean;
  payoff_month?: string;
  history: MonthBalance[];
  projection: MonthBalance[];
}

export interface GoalPoint {
  month: string;
  saved_cents: number;
  ideal_cents: number;
}

export interface GoalSeries {
  id: number;
  name: string;
  target_cents: number;
  series: GoalPoint[];
}

export interface ImportPreviewRow {
  source_ref: string;
  date: string;
  amount_cents: number;
  type: TransactionType;
  description: string;
  suggested_category_id: number;
  suggested_category_name: string;
  is_duplicate: boolean;
}

export interface ImportPreviewResponse {
  account_id: number;
  rows: ImportPreviewRow[];
  summary: { total: number; duplicates: number };
}

export interface ImportConfirmRow {
  source_ref: string;
  date: string;
  amount_cents: number;
  type: TransactionType;
  category_id: number;
  description: string;
}

export interface ImportConfirmResponse {
  created: number;
  skipped_duplicates: number;
}

export interface Dashboard {
  from: string;
  to: string;
  kpis: Kpis;
  net_worth: NetWorthPoint[];
  cashflow: CashflowPoint[];
  spending_by_category: SpendingPoint[];
  debts: DebtSeries[];
  investments: InvestmentPoint[];
  goals: GoalSeries[];
}
