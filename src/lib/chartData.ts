import type { DebtSeries, GoalSeries, SpendingPoint } from '../types';
import { addMonths } from './format';

export type SpendingRow = { month: string } & Record<string, number | string>;

export const OTHER_CATEGORY_LABEL = 'Outras';
export const MAX_NAMED_SPENDING_CATEGORIES = 5;
export const MAX_CATEGORY_SLOTS = 7;

export interface SpendingChart {
  rows: SpendingRow[];
  categories: string[];
  /** 0-based categorical slot per category name; absent for the synthetic "Outras" bucket. */
  categorySlots: Record<string, number>;
}

export interface CategorySlotAssigner {
  /**
   * Returns the stable slot for this category id, claiming the next free one
   * on first sight. When every slot is taken and `inView` is given, the slot
   * of a claimed category outside `inView` is taken over. `undefined` means
   * the category belongs in "Outras" instead.
   */
  slotFor(categoryId: number, inView?: ReadonlySet<number>): number | undefined;
}

/**
 * First-come, first-served: a category id keeps its slot while it stays in
 * view, so its color does not change just because other categories came and
 * went around it (AC-D3). Slots are never shared by two ids at once and never
 * wrap around with a modulo (BUG-01). A slot is only handed over from a
 * category that left the named set, so a current top category always gets one.
 */
export function createCategorySlotAssigner(maxSlots: number = MAX_CATEGORY_SLOTS): CategorySlotAssigner {
  const slotByCategoryId = new Map<number, number>();
  let nextSlot = 0;
  return {
    slotFor(categoryId, inView) {
      const existing = slotByCategoryId.get(categoryId);
      if (existing !== undefined) return existing;
      if (nextSlot < maxSlots) {
        const slot = nextSlot;
        nextSlot += 1;
        slotByCategoryId.set(categoryId, slot);
        return slot;
      }
      if (!inView) return undefined;
      const evictable = [...slotByCategoryId].find(([id]) => !inView.has(id));
      if (!evictable) return undefined;
      const [evictedId, slot] = evictable;
      slotByCategoryId.delete(evictedId);
      slotByCategoryId.set(categoryId, slot);
      return slot;
    },
  };
}

/**
 * Only the 5 categories with the largest total over the whole period are
 * named; the rest are summed into "Outras". Ties keep creation order (lowest
 * category_id first). Named categories are offered to the slot assigner in
 * that same order, with the current named set as `inView`, so colors stay
 * stable across period changes and never repeat among the named ones. Passing
 * the SAME assigner across calls (one per mounted chart) is what keeps a
 * category's color steady; a fresh assigner only guarantees no collisions
 * within that single call.
 */
export function pivotSpending(
  points: SpendingPoint[],
  months: string[],
  assigner: CategorySlotAssigner = createCategorySlotAssigner(),
): SpendingChart {
  const firstSeenId = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const point of points) {
    const seen = firstSeenId.get(point.category);
    if (seen === undefined || point.category_id < seen) firstSeenId.set(point.category, point.category_id);
    totals.set(point.category, (totals.get(point.category) ?? 0) + point.amount_cents);
  }
  const byCreationOrder = [...firstSeenId.keys()].sort(
    (a, b) => (firstSeenId.get(a) ?? 0) - (firstSeenId.get(b) ?? 0),
  );
  const byTotal = [...byCreationOrder].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
  const namedCategories = new Set(byTotal.slice(0, MAX_NAMED_SPENDING_CATEGORIES));
  const namedIds = new Set([...namedCategories].map((c) => firstSeenId.get(c) ?? 0));

  const categories: string[] = [];
  const categorySlots: Record<string, number> = {};
  const overflow = new Set<string>(byCreationOrder.filter((c) => !namedCategories.has(c)));
  for (const category of byCreationOrder) {
    if (overflow.has(category)) continue;
    const slot = assigner.slotFor(firstSeenId.get(category) as number, namedIds);
    if (slot === undefined) {
      overflow.add(category);
      continue;
    }
    categorySlots[category] = slot;
    categories.push(category);
  }
  if (overflow.size > 0) categories.push(OTHER_CATEGORY_LABEL);

  const rows = months.map((month) => {
    const row: SpendingRow = { month };
    const monthPoints = points.filter((p) => p.month === month);
    if (monthPoints.length > 0) {
      for (const category of categories) row[category] = 0;
    }
    for (const point of monthPoints) {
      const key = overflow.has(point.category) ? OTHER_CATEGORY_LABEL : point.category;
      row[key] = Number(row[key] ?? 0) + point.amount_cents;
    }
    return row;
  });
  return { rows, categories, categorySlots };
}

export interface DebtChartRow {
  month: string;
  history?: number;
  projection?: number;
}

export interface DebtChart {
  rows: DebtChartRow[];
  upcoming: string[];
  truncated: boolean;
}

export const TOTAL_PROJECTION_MONTHS = 24;

/**
 * "all" sums the debts that have already started, with the projection cut at
 * 24 months so one long loan does not flatten the history; debts that have
 * not started are listed in `upcoming` instead of jumping into the total. A
 * single debt is shown whole, and one that has not started is drawn from its
 * start month.
 */
export function buildDebtChart(debts: DebtSeries[], selection: number | 'all'): DebtChart {
  if (selection !== 'all') {
    const debt = debts.find((d) => d.id === selection);
    return { rows: debt ? sumDebts([withStartPoint(debt)]) : [], upcoming: [], truncated: false };
  }
  const started = debts.filter((d) => !d.not_started);
  const rows = sumDebts(started);
  const lastHistory = rows.filter((r) => r.history !== undefined).at(-1)?.month;
  const horizon = lastHistory ? addMonths(lastHistory, TOTAL_PROJECTION_MONTHS) : undefined;
  const visible = horizon ? rows.filter((r) => r.month <= horizon) : rows;
  return {
    rows: visible,
    upcoming: debts.filter((d) => d.not_started).map((d) => d.name),
    truncated: visible.length < rows.length,
  };
}

function withStartPoint(debt: DebtSeries): DebtSeries {
  const first = debt.projection[0];
  if (!debt.not_started || !first) return debt;
  return {
    ...debt,
    projection: [
      { month: addMonths(first.month, -1), balance_cents: debt.balance_cents },
      ...debt.projection,
    ],
  };
}

function sumDebts(debts: DebtSeries[]): DebtChartRow[] {
  const history = new Map<string, number>();
  const projection = new Map<string, number>();
  for (const debt of debts) {
    for (const point of debt.history) {
      history.set(point.month, (history.get(point.month) ?? 0) + point.balance_cents);
    }
  }

  const projectedMonths = [...new Set(debts.flatMap((d) => d.projection.map((p) => p.month)))].sort();
  for (const month of projectedMonths) {
    let total = 0;
    for (const debt of debts) {
      const point = debt.projection.find((p) => p.month === month);
      if (point) total += point.balance_cents;
      else if (debt.never_pays_off) total += debt.balance_cents;
    }
    projection.set(month, total);
  }

  const historyMonths = [...history.keys()].sort();
  const lastHistoryMonth = historyMonths.at(-1);
  const rows: DebtChartRow[] = historyMonths.map((month) => {
    const value = history.get(month) ?? 0;
    return month === lastHistoryMonth && projection.size > 0
      ? { month, history: value, projection: value }
      : { month, history: value };
  });
  for (const month of projectedMonths) rows.push({ month, projection: projection.get(month) ?? 0 });
  return rows;
}

export interface GoalChartRow {
  month: string;
  saved: number;
  ideal: number;
}

export function buildGoalChart(goals: GoalSeries[], selection: number | 'all'): GoalChartRow[] {
  const selected = selection === 'all' ? goals : goals.filter((g) => g.id === selection);
  const rows = new Map<string, GoalChartRow>();
  for (const goal of selected) {
    for (const point of goal.series) {
      const row = rows.get(point.month) ?? { month: point.month, saved: 0, ideal: 0 };
      row.saved += point.saved_cents;
      row.ideal += point.ideal_cents;
      rows.set(point.month, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
}
