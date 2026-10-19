import type {
  Account,
  AccountType,
  Category,
  Dashboard,
  DatedAmount,
  Debt,
  DebtInput,
  Goal,
  GoalInput,
  ImportConfirmResponse,
  ImportConfirmRow,
  ImportPreviewResponse,
  InstallmentInput,
  Investment,
  InvestmentType,
  Transaction,
  TransactionInput,
  TransactionType,
  Valuation,
} from '../types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_API_URL = 'http://127.0.0.1:8080';

export function apiBaseUrl(configured: string | undefined): string {
  const url = configured?.trim();
  return url ? url.replace(/\/+$/, '') : DEFAULT_API_URL;
}

export const API_BASE_URL = apiBaseUrl(import.meta.env.VITE_API_URL as string | undefined);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(0, 'network', 'Não foi possível conectar ao servidor.');
  }

  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

async function requestForm<T>(method: string, path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, body: form });
  } catch {
    throw new ApiError(0, 'network', 'Não foi possível conectar ao servidor.');
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };
    if (payload.error?.code && payload.error.message) {
      return new ApiError(response.status, payload.error.code, payload.error.message);
    }
  } catch {
    // body was not JSON: fall through to the generic error
  }
  return new ApiError(response.status, 'unknown', 'Erro inesperado do servidor.');
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export interface TransactionFilter {
  from?: string;
  to?: string;
  type?: TransactionType;
}

export const api = {
  listAccounts: () => request<Account[]>('GET', '/api/accounts'),
  createAccount: (input: { name: string; type: AccountType }) =>
    request<Account>('POST', '/api/accounts', input),
  deleteAccount: (id: number) => request<void>('DELETE', `/api/accounts/${id}`),

  listCategories: () => request<Category[]>('GET', '/api/categories'),
  createCategory: (input: { name: string }) => request<Category>('POST', '/api/categories', input),
  deleteCategory: (id: number) => request<void>('DELETE', `/api/categories/${id}`),

  listTransactions: (filter: TransactionFilter = {}) =>
    request<Transaction[]>('GET', withQuery('/api/transactions', { ...filter })),
  createTransaction: (input: TransactionInput) => request<Transaction>('POST', '/api/transactions', input),
  createInstallments: (input: InstallmentInput) =>
    request<Transaction[]>('POST', '/api/transactions/installments', input),
  deleteTransaction: (id: number) => request<void>('DELETE', `/api/transactions/${id}`),
  deleteInstallmentGroup: (group: string) => request<void>('DELETE', `/api/installments/${group}`),

  listInvestments: () => request<Investment[]>('GET', '/api/investments'),
  createInvestment: (input: { name: string; type: InvestmentType }) =>
    request<Investment>('POST', '/api/investments', input),
  deleteInvestment: (id: number) => request<void>('DELETE', `/api/investments/${id}`),
  addContribution: (id: number, input: { date: string; amount_cents: number }) =>
    request<DatedAmount>('POST', `/api/investments/${id}/contributions`, input),
  deleteContribution: (id: number, childId: number) =>
    request<void>('DELETE', `/api/investments/${id}/contributions/${childId}`),
  addValuation: (id: number, input: { date: string; value_cents: number }) =>
    request<Valuation>('POST', `/api/investments/${id}/valuations`, input),
  deleteValuation: (id: number, childId: number) =>
    request<void>('DELETE', `/api/investments/${id}/valuations/${childId}`),

  listGoals: () => request<Goal[]>('GET', '/api/goals'),
  createGoal: (input: GoalInput) => request<Goal>('POST', '/api/goals', input),
  deleteGoal: (id: number) => request<void>('DELETE', `/api/goals/${id}`),
  addGoalContribution: (id: number, input: { date: string; amount_cents: number }) =>
    request<DatedAmount>('POST', `/api/goals/${id}/contributions`, input),
  deleteGoalContribution: (id: number, childId: number) =>
    request<void>('DELETE', `/api/goals/${id}/contributions/${childId}`),

  listDebts: () => request<Debt[]>('GET', '/api/debts'),
  createDebt: (input: DebtInput) => request<Debt>('POST', '/api/debts', input),
  deleteDebt: (id: number) => request<void>('DELETE', `/api/debts/${id}`),
  addPayment: (id: number, input: { date: string; amount_cents: number }) =>
    request<DatedAmount>('POST', `/api/debts/${id}/payments`, input),
  deletePayment: (id: number, childId: number) =>
    request<void>('DELETE', `/api/debts/${id}/payments/${childId}`),

  getDashboard: (period: { from?: string; to: string }) =>
    request<Dashboard>('GET', withQuery('/api/dashboard', { ...period })),

  previewOFXImport: (accountId: number, file: File) => {
    const form = new FormData();
    form.set('account_id', String(accountId));
    form.set('file', file);
    return requestForm<ImportPreviewResponse>('POST', '/api/import/ofx/preview', form);
  },
  confirmOFXImport: (input: { account_id: number; rows: ImportConfirmRow[] }) =>
    request<ImportConfirmResponse>('POST', '/api/import/ofx/confirm', input),
};
