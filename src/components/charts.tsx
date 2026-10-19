import { useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildDebtChart,
  buildGoalChart,
  createCategorySlotAssigner,
  pivotSpending,
  TOTAL_PROJECTION_MONTHS,
  type CategorySlotAssigner,
} from '../lib/chartData';
import { formatAxisBRL, formatChartMonth, formatChartValue, formatMonth } from '../lib/format';
import { paletteFor, type Palette } from '../lib/palette';
import { useTheme } from '../lib/theme';
import type {
  CashflowPoint,
  DebtSeries,
  GoalSeries,
  InvestmentPoint,
  NetWorthPoint,
  SpendingPoint,
} from '../types';
import { Field } from './ui';

function usePalette(): Palette {
  return paletteFor(useTheme().theme);
}

function ChartFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="chart-box" role="img" aria-label={label}>
      {children}
    </div>
  );
}

function NoData({ message }: { message: string }) {
  return <p className="muted">{message}</p>;
}

function useAxes(palette: Palette) {
  const tick = { fill: palette.axis, fontSize: 12 };
  return {
    // Hairline, never dashed: a stacked bar's own segments carry the
    // detail, so the backdrop grid should recede, not compete (B-01).
    grid: <CartesianGrid stroke={palette.grid} />,
    x: <XAxis dataKey="month" tickFormatter={formatMonth} tick={tick} stroke={palette.grid} />,
    y: <YAxis tickFormatter={formatAxisBRL} tick={tick} stroke={palette.grid} width={84} />,
    tooltip: <Tooltip formatter={formatChartValue} labelFormatter={formatChartMonth} />,
    // The default Legend paints each label in its series color; that is the
    // one place in the app a status/series hue would carry text, which
    // AC-D6 forbids. Labels stay in the secondary ink — the swatch next to
    // them still carries the color (BUG-02).
    legend: (
      <Legend formatter={(value: string) => <span style={{ color: palette.textSecondary }}>{value}</span>} />
    ),
  };
}

export function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className="sparkline" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.06}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetWorthChart({ points }: { points: NetWorthPoint[] }) {
  const palette = usePalette();
  const axes = useAxes(palette);
  return (
    <ChartFrame label="Gráfico de área da evolução do patrimônio líquido por mês">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          {axes.grid}
          {axes.x}
          {axes.y}
          {axes.tooltip}
          <Area
            type="monotone"
            dataKey="net_worth_cents"
            name="Patrimônio líquido"
            stroke={palette.netWorth}
            fill={palette.netWorth}
            fillOpacity={0.22}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function CashflowChart({ points }: { points: CashflowPoint[] }) {
  const palette = usePalette();
  const axes = useAxes(palette);
  return (
    <ChartFrame label="Gráfico de barras de entradas e saídas por mês, com linha de saldo">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points}>
          {axes.grid}
          {axes.x}
          {axes.y}
          {axes.tooltip}
          {axes.legend}
          <Bar
            dataKey="income_cents"
            name="Entradas"
            fill={palette.income}
            stroke={palette.surface}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expense_cents"
            name="Saídas"
            fill={palette.expense}
            stroke={palette.surface}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="balance_cents"
            name="Saldo"
            stroke={palette.balance}
            strokeWidth={2}
            dot={{ r: 4, fill: palette.balance, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * One assigner per mounted chart, kept across re-renders (period filter
 * changes) so a category never changes color just because the set of other
 * categories visible around it changed (AC-D3) — see
 * `createCategorySlotAssigner` in lib/chartData.ts for why a fresh assigner
 * per render is not enough on its own.
 */
function useCategorySlotAssigner(): CategorySlotAssigner {
  const [assigner] = useState<CategorySlotAssigner>(() => createCategorySlotAssigner());
  return assigner;
}

export function CategoryChart({ points, months }: { points: SpendingPoint[]; months: string[] }) {
  const palette = usePalette();
  const axes = useAxes(palette);
  const assigner = useCategorySlotAssigner();
  if (points.length === 0) return <NoData message="Nenhum gasto no período." />;

  const { rows, categories, categorySlots } = pivotSpending(points, months, assigner);
  return (
    <ChartFrame label="Gráfico de barras empilhadas dos gastos por categoria em cada mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          {axes.grid}
          {axes.x}
          {axes.y}
          {axes.tooltip}
          {axes.legend}
          {categories.map((category) => {
            const slot = categorySlots[category];
            const fill =
              slot === undefined
                ? palette.otherCategory
                : (palette.categories[slot] ?? palette.otherCategory);
            return (
              <Bar
                key={category}
                dataKey={category}
                stackId="spending"
                fill={fill}
                stroke={palette.surface}
                strokeWidth={2}
                isAnimationActive={false}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DebtChart({ debts }: { debts: DebtSeries[] }) {
  const palette = usePalette();
  const axes = useAxes(palette);
  const [selection, setSelection] = useState<'all' | number>('all');
  if (debts.length === 0) return <NoData message="Nenhuma dívida cadastrada." />;

  const { rows, upcoming, truncated } = buildDebtChart(debts, selection);
  const shown = selection === 'all' ? debts : debts.filter((d) => d.id === selection);
  const neverPaysOff = shown.filter((d) => d.never_pays_off).map((d) => d.name);
  return (
    <>
      <Field label="Dívida exibida">
        {(props) => (
          <select
            {...props}
            value={String(selection)}
            onChange={(e) => setSelection(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">Todas as dívidas</option>
            {debts.map((debt) => (
              <option key={debt.id} value={debt.id}>
                {debt.not_started ? `${debt.name} (a iniciar)` : debt.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <ChartFrame label="Gráfico de linhas do saldo devedor, com projeção tracejada até a quitação">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            {axes.grid}
            {axes.x}
            {axes.y}
            {axes.tooltip}
            {axes.legend}
            <Line
              type="monotone"
              dataKey="history"
              name="Saldo devedor"
              stroke={palette.debt}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="projection"
              name="Projeção"
              stroke={palette.debtProjection}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
      {upcoming.length > 0 && (
        <p className="muted">
          Dívidas a iniciar ficam fora do total: {upcoming.join(', ')}. Escolha uma delas em "Dívida exibida"
          para ver a projeção a partir do início.
        </p>
      )}
      {truncated && (
        <p className="muted">
          Projeção limitada aos próximos {TOTAL_PROJECTION_MONTHS} meses no total; escolha uma dívida para ver
          até a quitação.
        </p>
      )}
      {neverPaysOff.length > 0 && (
        <p className="muted">
          Sem previsão de quitação (parcela não cobre os juros): {neverPaysOff.join(', ')}.
        </p>
      )}
    </>
  );
}

export function InvestmentChart({ points }: { points: InvestmentPoint[] }) {
  const palette = usePalette();
  const axes = useAxes(palette);
  if (points.every((p) => p.invested_cents === 0 && p.current_cents === 0)) {
    return <NoData message="Nenhum investimento no período." />;
  }
  return (
    <ChartFrame label="Gráfico de linhas do total aportado e do valor atual dos investimentos por mês">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          {axes.grid}
          {axes.x}
          {axes.y}
          {axes.tooltip}
          {axes.legend}
          <Line
            type="monotone"
            dataKey="invested_cents"
            name="Aportado"
            stroke={palette.invested}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="current_cents"
            name="Valor atual"
            stroke={palette.current}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function GoalsChart({ goals }: { goals: GoalSeries[] }) {
  const palette = usePalette();
  const axes = useAxes(palette);
  const [selection, setSelection] = useState<'all' | number>('all');
  if (goals.length === 0) return <NoData message="Nenhuma meta cadastrada." />;

  const rows = buildGoalChart(goals, selection);
  return (
    <>
      <Field label="Meta exibida">
        {(props) => (
          <select
            {...props}
            value={String(selection)}
            onChange={(e) => setSelection(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">Todas as metas</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <ChartFrame label="Gráfico de linhas do valor acumulado nas metas contra o ritmo ideal">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            {axes.grid}
            {axes.x}
            {axes.y}
            {axes.tooltip}
            {axes.legend}
            <Line
              type="monotone"
              dataKey="saved"
              name="Acumulado"
              stroke={palette.saved}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ideal"
              name="Ritmo ideal"
              stroke={palette.ideal}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  );
}
