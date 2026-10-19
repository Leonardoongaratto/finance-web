import { describe, expect, it } from 'vitest';
import type { DebtSeries, GoalSeries, SpendingPoint } from '../types';
import {
  buildDebtChart,
  buildGoalChart,
  createCategorySlotAssigner,
  OTHER_CATEGORY_LABEL,
  pivotSpending,
} from './chartData';
import { addMonths } from './format';

describe('pivotSpending', () => {
  const points: SpendingPoint[] = [
    { month: '2026-09', category_id: 2, category: 'Alimentação', amount_cents: 20000 },
    { month: '2026-09', category_id: 3, category: 'Transporte', amount_cents: 5000 },
    { month: '2026-10', category_id: 2, category: 'Alimentação', amount_cents: 10000 },
  ];

  it('creates one row per month with a column per category', () => {
    const { rows, categories } = pivotSpending(points, ['2026-09', '2026-10']);
    expect(categories).toEqual(['Alimentação', 'Transporte']);
    expect(rows).toEqual([
      { month: '2026-09', Alimentação: 20000, Transporte: 5000 },
      { month: '2026-10', Alimentação: 10000, Transporte: 0 },
    ]);
  });

  it('keeps months without spending as empty rows', () => {
    const { rows } = pivotSpending([], ['2026-09']);
    expect(rows).toEqual([{ month: '2026-09' }]);
  });

  it('orders categories by creation order (lowest category_id), not by first appearance (AC-D3)', () => {
    const outOfOrder: SpendingPoint[] = [
      { month: '2026-09', category_id: 5, category: 'Lazer', amount_cents: 100 },
      { month: '2026-09', category_id: 1, category: 'Moradia', amount_cents: 200 },
    ];
    const { categories, categorySlots } = pivotSpending(outOfOrder, ['2026-09']);
    expect(categories).toEqual(['Moradia', 'Lazer']);
    expect(categorySlots).toEqual({ Moradia: 0, Lazer: 1 });
  });

  it('names only the 5 categories with the largest period total and sums the rest into "Outras" (AC-U3)', () => {
    const many: SpendingPoint[] = Array.from({ length: 9 }, (_, i) => ({
      month: '2026-09',
      category_id: i + 1,
      category: `Categoria ${i + 1}`,
      amount_cents: 100 * (i + 1),
    }));
    const { rows, categories, categorySlots } = pivotSpending(many, ['2026-09']);
    expect(categories).toEqual([
      'Categoria 5',
      'Categoria 6',
      'Categoria 7',
      'Categoria 8',
      'Categoria 9',
      OTHER_CATEGORY_LABEL,
    ]);
    expect(Object.keys(categorySlots)).toHaveLength(5);
    expect(categorySlots['Categoria 4']).toBeUndefined();
    expect(rows[0]?.[OTHER_CATEGORY_LABEL]).toBe(100 + 200 + 300 + 400);
  });

  it('ranks categories by their total across the period, not by one month (AC-U3)', () => {
    const spread: SpendingPoint[] = ['2026-08', '2026-09', '2026-10', '2026-11'].map((month) => ({
      month,
      category_id: 1,
      category: 'Espalhada',
      amount_cents: 100,
    }));
    const single: SpendingPoint[] = [2, 3, 4, 5, 6].map((id) => ({
      month: '2026-10',
      category_id: id,
      category: `Pontual ${id}`,
      amount_cents: 150,
    }));
    const { categories } = pivotSpending(
      [...spread, ...single],
      ['2026-08', '2026-09', '2026-10', '2026-11'],
    );
    expect(categories).toContain('Espalhada');
    expect(categories).toContain('Pontual 2');
    expect(categories).not.toContain('Pontual 6');
    expect(categories.at(-1)).toBe(OTHER_CATEGORY_LABEL);
  });

  it('keeps 5 categories without an "Outras" bucket', () => {
    const five: SpendingPoint[] = Array.from({ length: 5 }, (_, i) => ({
      month: '2026-09',
      category_id: i + 1,
      category: `Categoria ${i + 1}`,
      amount_cents: 100,
    }));
    const { categories } = pivotSpending(five, ['2026-09']);
    expect(categories).toHaveLength(5);
    expect(categories).not.toContain(OTHER_CATEGORY_LABEL);
  });

  it('never repeats a color among the named categories when the top 5 changes between periods (AC-U3)', () => {
    const assigner = createCategorySlotAssigner();
    const first: SpendingPoint[] = [1, 2, 3, 4, 5].map((id) => ({
      month: '2026-09',
      category_id: id,
      category: `Categoria ${id}`,
      amount_cents: 100,
    }));
    pivotSpending(first, ['2026-09'], assigner);

    const second: SpendingPoint[] = [
      { month: '2026-10', category_id: 6, category: 'Categoria 6', amount_cents: 1000 },
      { month: '2026-10', category_id: 7, category: 'Categoria 7', amount_cents: 1000 },
      { month: '2026-10', category_id: 1, category: 'Categoria 1', amount_cents: 10 },
      { month: '2026-10', category_id: 2, category: 'Categoria 2', amount_cents: 10 },
      { month: '2026-10', category_id: 3, category: 'Categoria 3', amount_cents: 10 },
      { month: '2026-10', category_id: 4, category: 'Categoria 4', amount_cents: 5 },
      { month: '2026-10', category_id: 5, category: 'Categoria 5', amount_cents: 5 },
    ];
    const { categories, categorySlots } = pivotSpending(second, ['2026-10'], assigner);
    const named = categories.filter((c) => c !== OTHER_CATEGORY_LABEL);
    expect(named).toHaveLength(5);
    expect(new Set(named.map((c) => categorySlots[c])).size).toBe(5);
    expect(categories.at(-1)).toBe(OTHER_CATEGORY_LABEL);
    expect(categorySlots['Categoria 1']).toBe(0);
  });

  it('BUG-01 regression: Alimentação (id 2) and Outros (id 9) never share a slot', () => {
    const points: SpendingPoint[] = [
      { month: '2026-09', category_id: 2, category: 'Alimentação', amount_cents: 100 },
      { month: '2026-09', category_id: 9, category: 'Outros', amount_cents: 200 },
    ];
    const { categorySlots } = pivotSpending(points, ['2026-09']);
    expect(categorySlots.Alimentação).not.toBe(categorySlots.Outros);
    expect(new Set(Object.values(categorySlots)).size).toBe(2);
  });

  it('BUG-01 regression: Moradia (1), Salário (8) and Outros (9) each get their own slot when only 3 are present', () => {
    const points: SpendingPoint[] = [
      { month: '2026-09', category_id: 1, category: 'Moradia', amount_cents: 100 },
      { month: '2026-09', category_id: 8, category: 'Salário', amount_cents: 200 },
      { month: '2026-09', category_id: 9, category: 'Outros', amount_cents: 300 },
    ];
    const { categorySlots, categories } = pivotSpending(points, ['2026-09']);
    expect(categories).not.toContain(OTHER_CATEGORY_LABEL);
    expect(new Set(Object.values(categorySlots)).size).toBe(3);
  });
});

describe('createCategorySlotAssigner', () => {
  it('never reuses a slot by wrapping around (no modulo): distinct ids always get distinct slots up to the cap', () => {
    const assigner = createCategorySlotAssigner();
    const slot1 = assigner.slotFor(1);
    const slot8 = assigner.slotFor(8);
    expect(slot1).not.toBe(slot8);
  });

  it('keeps a category pinned to the same slot across separate calls (stable across a period filter change)', () => {
    const assigner = createCategorySlotAssigner();
    const full = pivotSpending(
      [
        { month: '2026-09', category_id: 1, category: 'Moradia', amount_cents: 100 },
        { month: '2026-09', category_id: 2, category: 'Alimentação', amount_cents: 100 },
        { month: '2026-09', category_id: 9, category: 'Outros', amount_cents: 100 },
      ],
      ['2026-09'],
      assigner,
    );
    const filtered = pivotSpending(
      [{ month: '2026-09', category_id: 9, category: 'Outros', amount_cents: 100 }],
      ['2026-09'],
      assigner,
    );
    expect(filtered.categorySlots.Outros).toBe(full.categorySlots.Outros);
  });

  it('sends a brand-new category to "Outras" once every slot is already claimed by other categories', () => {
    const assigner = createCategorySlotAssigner();
    for (let id = 1; id <= 7; id += 1) assigner.slotFor(id);
    expect(assigner.slotFor(8)).toBeUndefined();
  });

  it('frees the slot of a category outside the named set when a named one needs it (AC-U3)', () => {
    const assigner = createCategorySlotAssigner(2);
    const slotOfFirst = assigner.slotFor(1);
    assigner.slotFor(2);
    expect(assigner.slotFor(3, new Set([3, 2]))).toBe(slotOfFirst);
  });
});

describe('buildDebtChart', () => {
  const debt = (overrides: Partial<DebtSeries>): DebtSeries => ({
    id: 1,
    name: 'D',
    balance_cents: 0,
    never_pays_off: false,
    not_started: false,
    history: [],
    projection: [],
    ...overrides,
  });

  const monthly = (from: string, count: number, start: number, step: number) =>
    Array.from({ length: count }, (_, i) => ({
      month: addMonths(from, i),
      balance_cents: Math.max(start - step * i, 0),
    }));

  it('leaves debts that have not started out of the total and names them', () => {
    const chart = buildDebtChart(
      [
        debt({ id: 1, name: 'Carro', history: [{ month: '2026-10', balance_cents: 3000 }] }),
        debt({
          id: 2,
          name: 'Apartamento',
          not_started: true,
          balance_cents: 250000,
          projection: [{ month: '2027-04', balance_cents: 240000 }],
        }),
      ],
      'all',
    );
    expect(chart.rows).toEqual([{ month: '2026-10', history: 3000 }]);
    expect(chart.upcoming).toEqual(['Apartamento']);
    expect(chart.truncated).toBe(false);
  });

  it('shows one debt that has not started from its start month', () => {
    const chart = buildDebtChart(
      [
        debt({ id: 1, history: [{ month: '2026-10', balance_cents: 3000 }] }),
        debt({
          id: 2,
          not_started: true,
          balance_cents: 250000,
          projection: [
            { month: '2027-04', balance_cents: 240000 },
            { month: '2027-05', balance_cents: 0 },
          ],
        }),
      ],
      2,
    );
    expect(chart.rows).toEqual([
      { month: '2027-03', projection: 250000 },
      { month: '2027-04', projection: 240000 },
      { month: '2027-05', projection: 0 },
    ]);
    expect(chart.upcoming).toEqual([]);
  });

  it('limits the projection of the total to 24 months, but not of a single debt (AC-D5, T-06)', () => {
    const long = debt({
      id: 1,
      balance_cents: 120000,
      history: [{ month: '2026-10', balance_cents: 120000 }],
      projection: monthly('2026-11', 100, 119000, 1000),
    });
    const total = buildDebtChart([long], 'all');
    expect(total.truncated).toBe(true);
    expect(total.rows.at(-1)?.month).toBe('2028-10');
    const single = buildDebtChart([long], 1);
    expect(single.truncated).toBe(false);
    expect(single.rows).toHaveLength(101);
  });

  it('sums history across debts and anchors the projection on the last history point', () => {
    const { rows } = buildDebtChart(
      [
        debt({
          id: 1,
          balance_cents: 75000,
          history: [
            { month: '2026-09', balance_cents: 75000 },
            { month: '2026-10', balance_cents: 75000 },
          ],
          projection: [
            { month: '2026-11', balance_cents: 50000 },
            { month: '2026-12', balance_cents: 0 },
          ],
        }),
        debt({
          id: 2,
          balance_cents: 1000,
          history: [
            { month: '2026-09', balance_cents: 1000 },
            { month: '2026-10', balance_cents: 1000 },
          ],
          projection: [{ month: '2026-11', balance_cents: 0 }],
        }),
      ],
      'all',
    );
    expect(rows).toEqual([
      { month: '2026-09', history: 76000 },
      { month: '2026-10', history: 76000, projection: 76000 },
      { month: '2026-11', projection: 50000 },
      { month: '2026-12', projection: 0 },
    ]);
  });

  it('holds the balance flat for debts that never pay off', () => {
    const { rows } = buildDebtChart(
      [
        debt({
          id: 1,
          balance_cents: 900,
          never_pays_off: true,
          history: [{ month: '2026-10', balance_cents: 900 }],
        }),
        debt({
          id: 2,
          balance_cents: 100,
          history: [{ month: '2026-10', balance_cents: 100 }],
          projection: [{ month: '2026-11', balance_cents: 0 }],
        }),
      ],
      'all',
    );
    expect(rows.at(-1)).toEqual({ month: '2026-11', projection: 900 });
  });

  it('returns only history when there is nothing to project', () => {
    const { rows } = buildDebtChart([debt({ history: [{ month: '2026-10', balance_cents: 0 }] })], 'all');
    expect(rows).toEqual([{ month: '2026-10', history: 0 }]);
  });

  it('is empty without debts or for an unknown debt', () => {
    expect(buildDebtChart([], 'all').rows).toEqual([]);
    expect(buildDebtChart([debt({})], 99).rows).toEqual([]);
  });
});

describe('buildGoalChart', () => {
  const goals: GoalSeries[] = [
    {
      id: 1,
      name: 'Viagem',
      target_cents: 1000,
      series: [
        { month: '2026-09', saved_cents: 100, ideal_cents: 200 },
        { month: '2026-10', saved_cents: 300, ideal_cents: 400 },
      ],
    },
    {
      id: 2,
      name: 'Reserva',
      target_cents: 500,
      series: [
        { month: '2026-09', saved_cents: 10, ideal_cents: 20 },
        { month: '2026-10', saved_cents: 30, ideal_cents: 40 },
      ],
    },
  ];

  it('sums all goals', () => {
    expect(buildGoalChart(goals, 'all')).toEqual([
      { month: '2026-09', saved: 110, ideal: 220 },
      { month: '2026-10', saved: 330, ideal: 440 },
    ]);
  });

  it('selects one goal', () => {
    expect(buildGoalChart(goals, 2)).toEqual([
      { month: '2026-09', saved: 10, ideal: 20 },
      { month: '2026-10', saved: 30, ideal: 40 },
    ]);
  });

  it('is empty for an unknown goal', () => {
    expect(buildGoalChart(goals, 99)).toEqual([]);
  });
});
