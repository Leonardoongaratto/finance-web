import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, apiBaseUrl, ApiError, API_BASE_URL } from './api';

const BASE = 'http://127.0.0.1:8080';

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('GETs JSON', async () => {
    const fetchMock = stubFetch(200, [{ id: 1, name: 'Conta', type: 'cash' }]);
    const accounts = await api.listAccounts();
    expect(accounts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/accounts`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('POSTs a JSON body with the right content type', async () => {
    const fetchMock = stubFetch(201, { id: 1 });
    await api.createAccount({ name: 'Conta', type: 'cash' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Conta', type: 'cash' }));
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('returns undefined for 204 responses', async () => {
    stubFetch(204);
    await expect(api.deleteAccount(3)).resolves.toBeUndefined();
  });

  it('maps API errors to ApiError with code and message', async () => {
    stubFetch(409, { error: { code: 'conflict', message: 'resource is in use' } });
    const error = await api.deleteCategory(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'conflict', message: 'resource is in use' });
  });

  it('falls back to a generic error when the body is not the API error shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>boom</html>', { status: 502 })));
    const error = await api.listGoals().catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'unknown' });
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')));
    const error = await api.listDebts().catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: 'network' });
  });

  it('builds the dashboard query string from the period', async () => {
    const fetchMock = stubFetch(200, {});
    await api.getDashboard({ from: '2026-05', to: '2026-10' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/api/dashboard?from=2026-05&to=2026-10`);
    await api.getDashboard({ to: '2026-10' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${BASE}/api/dashboard?to=2026-10`);
  });

  it('builds transaction filters', async () => {
    const fetchMock = stubFetch(200, []);
    await api.listTransactions({ from: '2026-10-01', type: 'income' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/api/transactions?from=2026-10-01&type=income`);
    await api.listTransactions();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${BASE}/api/transactions`);
  });

  it('targets the nested resource routes', async () => {
    const fetchMock = stubFetch(204);
    await api.deleteInstallmentGroup('abc');
    await api.deleteContribution(1, 2);
    await api.deleteValuation(1, 3);
    await api.deleteGoalContribution(4, 5);
    await api.deletePayment(6, 7);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      `${BASE}/api/installments/abc`,
      `${BASE}/api/investments/1/contributions/2`,
      `${BASE}/api/investments/1/valuations/3`,
      `${BASE}/api/goals/4/contributions/5`,
      `${BASE}/api/debts/6/payments/7`,
    ]);
  });

  it('posts to creation routes', async () => {
    const fetchMock = stubFetch(201, {});
    const date = '2026-10-01';
    await api.createCategory({ name: 'Pets' });
    await api.createTransaction({
      type: 'expense',
      amount_cents: 1,
      date,
      account_id: 1,
      category_id: 1,
      description: '',
    });
    await api.createInstallments({
      total_cents: 100,
      installments: 2,
      first_date: date,
      account_id: 1,
      category_id: 1,
      description: '',
    });
    await api.createInvestment({ name: 'CDB', type: 'fixed_income' });
    await api.addContribution(1, { date, amount_cents: 1 });
    await api.addValuation(1, { date, value_cents: 1 });
    await api.createGoal({ name: 'Meta', target_cents: 1, deadline: date });
    await api.addGoalContribution(1, { date, amount_cents: 1 });
    await api.createDebt({
      name: 'D',
      creditor: '',
      original_cents: 1,
      monthly_rate_bp: 0,
      monthly_payment_cents: 0,
      start_date: date,
    });
    await api.addPayment(1, { date, amount_cents: 1 });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      `${BASE}/api/categories`,
      `${BASE}/api/transactions`,
      `${BASE}/api/transactions/installments`,
      `${BASE}/api/investments`,
      `${BASE}/api/investments/1/contributions`,
      `${BASE}/api/investments/1/valuations`,
      `${BASE}/api/goals`,
      `${BASE}/api/goals/1/contributions`,
      `${BASE}/api/debts`,
      `${BASE}/api/debts/1/payments`,
    ]);
  });

  it('lists and deletes the remaining resources', async () => {
    const fetchMock = stubFetch(200, []);
    await api.listCategories();
    await api.listInvestments();
    stubFetch(204);
    await api.deleteTransaction(1);
    await api.deleteInvestment(2);
    await api.deleteGoal(3);
    await api.deleteDebt(4);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      `${BASE}/api/categories`,
      `${BASE}/api/investments`,
    ]);
  });

  it('calls the API on the default local address', async () => {
    expect(API_BASE_URL).toBe(BASE);
  });
});

describe('apiBaseUrl', () => {
  it('falls back to the local API when VITE_API_URL is unset or blank', () => {
    expect(apiBaseUrl(undefined)).toBe(BASE);
    expect(apiBaseUrl('')).toBe(BASE);
    expect(apiBaseUrl('   ')).toBe(BASE);
  });

  it('uses the configured URL without a trailing slash', () => {
    expect(apiBaseUrl('https://api.example.com')).toBe('https://api.example.com');
    expect(apiBaseUrl(' https://api.example.com/ ')).toBe('https://api.example.com');
  });
});
