import { describe, expect, it } from 'vitest';
import {
  addMonths,
  currentMonth,
  formatBRL,
  formatChartMonth,
  formatChartValue,
  formatDate,
  formatMonth,
  formatPercent,
  formatAxisBRL,
  isValidISODate,
  parseBRL,
  periodRange,
  todayISO,
} from './format';

describe('formatBRL', () => {
  it('formats cents as R$ 1.234,56', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
  });

  it('formats zero, small and large values', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(100000000)).toBe('R$ 1.000.000,00');
  });

  it('formats negative values', () => {
    expect(formatBRL(-250)).toBe('-R$ 2,50');
  });
});

describe('parseBRL', () => {
  it.each([
    ['1.234,56', 123456],
    ['R$ 1.234,56', 123456],
    ['1234,56', 123456],
    ['10', 1000],
    ['0,5', 50],
    ['12,05', 1205],
    ['1.000', 100000],
    ['1.234.567', 123456700],
    ['12.5', 1250],
    ['12.50', 1250],
    ['  300  ', 30000],
  ])('parses %s', (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });

  it.each(['', 'abc', '1,234', '1,2,3', 'R$', '-5', '1.2.3', '12,'])('rejects %s', (input) => {
    expect(parseBRL(input)).toBeNull();
  });
});

describe('dates', () => {
  it('formats ISO dates as dd/mm/aaaa', () => {
    expect(formatDate('2026-10-02')).toBe('02/10/2026');
  });

  it('formats months', () => {
    expect(formatMonth('2026-01')).toBe('jan/26');
    expect(formatMonth('2027-12')).toBe('dez/27');
  });

  it('builds today and current month from a given instant', () => {
    const now = new Date(2026, 9, 2, 23, 30);
    expect(todayISO(now)).toBe('2026-10-02');
    expect(currentMonth(now)).toBe('2026-10');
  });

  it('adds months across years', () => {
    expect(addMonths('2026-10', 3)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });

  it('validates ISO dates', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('02/10/2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });

  it('accepts only years from 1900 to 2199, like the API', () => {
    expect(isValidISODate('1900-01-01')).toBe(true);
    expect(isValidISODate('2199-12-31')).toBe(true);
    expect(isValidISODate('0026-05-10')).toBe(false);
    expect(isValidISODate('1899-12-31')).toBe(false);
    expect(isValidISODate('2200-01-01')).toBe(false);
  });
});

describe('periodRange', () => {
  const now = new Date(2026, 9, 2);

  it('covers the last n months ending in the current month', () => {
    expect(periodRange('3m', now)).toEqual({ from: '2026-08', to: '2026-10' });
    expect(periodRange('6m', now)).toEqual({ from: '2026-05', to: '2026-10' });
    expect(periodRange('12m', now)).toEqual({ from: '2025-11', to: '2026-10' });
  });

  it('omits from for all time', () => {
    expect(periodRange('all', now)).toEqual({ to: '2026-10' });
  });
});

describe('chart formatters', () => {
  it('formats tooltip values and month labels', () => {
    expect(formatChartValue(123456)).toBe('R$ 1.234,56');
    expect(formatChartValue('5000')).toBe('R$ 50,00');
    expect(formatChartMonth('2026-10')).toBe('out/26');
  });

  it('formats axis ticks compactly with non-breaking spaces so labels never wrap', () => {
    const NBSP = String.fromCharCode(0xa0);
    const readable = (cents: number) => formatAxisBRL(cents).replaceAll(NBSP, ' ');
    for (const cents of [-2000000, 28000000, 0, 123456789]) {
      expect(formatAxisBRL(cents)).not.toContain(' ');
    }
    expect(readable(0)).toBe('R$ 0');
    expect(readable(-2000000)).toBe('-R$ 20 mil');
    expect(readable(28000000)).toBe('R$ 280 mil');
    expect(readable(123456789)).toMatch(/^R\$ 1,2 ?mi/);
  });
});

describe('formatPercent', () => {
  it('uses pt-BR decimals', () => {
    expect(formatPercent(20)).toBe('20%');
    expect(formatPercent(12.5)).toBe('12,5%');
    expect(formatPercent(-3.26)).toBe('-3,3%');
  });
});
