export type Period = '3m' | '6m' | '12m' | 'all';

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const NBSP = String.fromCharCode(0xa0);

const currencyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatBRL(cents: number): string {
  return currencyFormat.format(cents / 100).replaceAll(NBSP, ' ');
}

const compactCurrencyFormat = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

// Recharts wraps tick labels on regular spaces; non-breaking ones keep "R$ 280 mil" on one line.
export function formatAxisBRL(cents: number): string {
  return compactCurrencyFormat.format(cents / 100).replace(/\s/g, NBSP);
}

export function formatChartValue(value: unknown): string {
  return formatBRL(Number(value));
}

export function formatChartMonth(label: unknown): string {
  return formatMonth(String(label));
}

export function formatPercent(value: number): string {
  return `${percentFormat.format(value)}%`;
}

/** Parses "1.234,56", "1234,56", "12.50" or "300" into integer cents; null when invalid. */
export function parseBRL(input: string): number | null {
  const text = input.replace(/^\s*R\$/, '').trim();
  const [whole, fraction] = splitAmount(text);
  if (whole === null || !/^\d+$/.test(whole)) return null;
  if (fraction !== undefined && !/^\d{1,2}$/.test(fraction)) return null;
  return Number(whole) * 100 + Number((fraction ?? '').padEnd(2, '0'));
}

function splitAmount(text: string): [string | null, string?] {
  if (text.includes(',')) {
    const parts = text.split(',');
    if (parts.length !== 2) return [null];
    const [integerPart = '', fraction] = parts;
    return [stripThousands(integerPart), fraction];
  }
  if (/^\d+\.\d{1,2}$/.test(text)) {
    const [integerPart = '', fraction] = text.split('.');
    return [integerPart, fraction];
  }
  return [stripThousands(text)];
}

function stripThousands(text: string): string | null {
  if (text.includes('.')) {
    return /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replaceAll('.', '') : null;
  }
  return text;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function formatMonth(month: string): string {
  const [year = '', monthNumber = '1'] = month.split('-');
  return `${MONTH_LABELS[Number(monthNumber) - 1]}/${year.slice(2)}`;
}

export function todayISO(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function addMonths(month: string, count: number): string {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  if (year < 1900 || year > 2199) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const PERIOD_MONTHS: Record<Exclude<Period, 'all'>, number> = { '3m': 3, '6m': 6, '12m': 12 };

export function periodRange(period: Period, now: Date = new Date()): { from?: string; to: string } {
  const to = currentMonth(now);
  if (period === 'all') return { to };
  return { from: addMonths(to, 1 - PERIOD_MONTHS[period]), to };
}
