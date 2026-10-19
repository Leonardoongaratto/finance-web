import { isValidISODate, parseBRL } from './format';

export type FormErrors = Record<string, string>;

export function requiredText(value: string, message: string): string | undefined {
  return value.trim() === '' ? message : undefined;
}

export function validDate(value: string): string | undefined {
  return isValidISODate(value) ? undefined : 'Informe uma data válida.';
}

export interface AmountResult {
  cents?: number;
  error?: string;
}

export function validAmount(text: string, { allowZero = false } = {}): AmountResult {
  const cents = parseBRL(text);
  if (cents === null) return { error: 'Informe um valor válido, como 1.234,56.' };
  if (cents === 0 && !allowZero) return { error: 'O valor deve ser maior que zero.' };
  return { cents };
}

export function validRatePercent(text: string): { bp?: number; error?: string } {
  if (text.trim() === '') return { bp: 0 };
  const cents = parseBRL(text);
  if (cents === null || cents > 10000) return { error: 'Informe uma taxa entre 0 e 100, como 1,5.' };
  return { bp: cents };
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function compact(errors: Record<string, string | undefined>): FormErrors {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
