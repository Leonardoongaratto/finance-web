import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { addMonths } from '../lib/format';
import { paletteFor } from '../lib/palette';
import { ThemeProvider } from '../lib/theme';
import type { DebtSeries, SpendingPoint } from '../types';
import { CategoryChart, DebtChart, Sparkline } from './charts';

function withTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function barFills(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.recharts-bar-rectangle path')].map(
    (p) => p.getAttribute('fill') ?? '',
  );
}

describe('CategoryChart', () => {
  it('names the 5 largest categories and groups the rest into "Outras" (AC-U3)', () => {
    const points: SpendingPoint[] = Array.from({ length: 9 }, (_, i) => ({
      month: '2026-09',
      category_id: i + 1,
      category: `Categoria ${i + 1}`,
      amount_cents: 100 * (i + 1),
    }));
    const { container } = withTheme(<CategoryChart points={points} months={['2026-09']} />);
    const palette = paletteFor('light');
    const fills = barFills(container);
    expect(fills).toHaveLength(6);
    expect(fills.at(-1)).toBe(palette.otherCategory);
    expect(new Set(fills.slice(0, 5)).size).toBe(5);
    expect(fills.slice(0, 5)).not.toContain(palette.otherCategory);
  });

  it('BUG-01 regression: Alimentação (id 2) and Outros (id 9) render with distinct colors, not both orange', () => {
    const points: SpendingPoint[] = [
      { month: '2026-09', category_id: 2, category: 'Alimentação', amount_cents: 100 },
      { month: '2026-09', category_id: 9, category: 'Outros', amount_cents: 200 },
    ];
    const { container } = withTheme(<CategoryChart points={points} months={['2026-09']} />);
    const fills = barFills(container);
    expect(fills).toHaveLength(2);
    expect(new Set(fills).size).toBe(2);
  });

  it('BUG-01 regression: Moradia (1), Salário (8) and Outros (9) each render with a distinct color', () => {
    const points: SpendingPoint[] = [
      { month: '2026-09', category_id: 1, category: 'Moradia', amount_cents: 100 },
      { month: '2026-09', category_id: 8, category: 'Salário', amount_cents: 200 },
      { month: '2026-09', category_id: 9, category: 'Outros', amount_cents: 300 },
    ];
    const { container } = withTheme(<CategoryChart points={points} months={['2026-09']} />);
    const fills = barFills(container);
    expect(fills).toHaveLength(3);
    expect(new Set(fills).size).toBe(3);
  });

  it('keeps a category color stable across a period-filter change on the SAME mounted chart (AC-D3)', () => {
    const full: SpendingPoint[] = [
      { month: '2026-09', category_id: 1, category: 'Moradia', amount_cents: 100 },
      { month: '2026-09', category_id: 2, category: 'Lazer', amount_cents: 100 },
      { month: '2026-09', category_id: 3, category: 'Transporte', amount_cents: 100 },
    ];
    const onlyLast: SpendingPoint[] = [
      { month: '2026-09', category_id: 3, category: 'Transporte', amount_cents: 100 },
    ];
    const { container, rerender } = withTheme(<CategoryChart points={full} months={['2026-09']} />);
    const colorInFull = barFills(container).at(-1);

    rerender(
      <ThemeProvider>
        <CategoryChart points={onlyLast} months={['2026-09']} />
      </ThemeProvider>,
    );
    const colorAlone = barFills(container)[0];
    expect(colorAlone).toBe(colorInFull);
  });
});

describe('DebtChart', () => {
  const debts: DebtSeries[] = [
    {
      id: 1,
      name: 'Carro',
      balance_cents: 120000,
      never_pays_off: false,
      not_started: false,
      history: [{ month: '2026-10', balance_cents: 120000 }],
      projection: Array.from({ length: 100 }, (_, i) => ({
        month: addMonths('2026-11', i),
        balance_cents: Math.max(119000 - i * 1000, 0),
      })),
    },
  ];

  it('shows the 24-month cut note for "Todas as dívidas" (AC-D5, T-06)', () => {
    withTheme(<DebtChart debts={debts} />);
    expect(
      screen.getByText(/Projeção limitada aos próximos 24 meses no total; escolha uma dívida/),
    ).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('renders a thin fill at low opacity instead of a saturated block (AC-D7)', () => {
    const { container } = withTheme(<Sparkline values={[1, 2, 3]} color="#1baf7a" label="Tendência" />);
    const area = container.querySelector('.recharts-area-area');
    expect(Number(area?.getAttribute('fill-opacity'))).toBeLessThanOrEqual(0.08);
  });
});
