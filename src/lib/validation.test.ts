import { describe, expect, it } from 'vitest';
import { compact, hasErrors, requiredText, validAmount, validDate, validRatePercent } from './validation';

describe('validation', () => {
  it('requires text', () => {
    expect(requiredText('  ', 'obrigatório')).toBe('obrigatório');
    expect(requiredText('ok', 'obrigatório')).toBeUndefined();
  });

  it('validates dates', () => {
    expect(validDate('2026-02-30')).toBeDefined();
    expect(validDate('2026-02-28')).toBeUndefined();
  });

  it('validates amounts', () => {
    expect(validAmount('abc').error).toBeDefined();
    expect(validAmount('0').error).toBeDefined();
    expect(validAmount('0', { allowZero: true })).toEqual({ cents: 0 });
    expect(validAmount('10,50')).toEqual({ cents: 1050 });
  });

  it('converts a percentage into basis points', () => {
    expect(validRatePercent('')).toEqual({ bp: 0 });
    expect(validRatePercent('1,5')).toEqual({ bp: 150 });
    expect(validRatePercent('100')).toEqual({ bp: 10000 });
    expect(validRatePercent('150').error).toBeDefined();
    expect(validRatePercent('x').error).toBeDefined();
  });

  it('compacts error maps', () => {
    const errors = compact({ a: 'erro', b: undefined });
    expect(errors).toEqual({ a: 'erro' });
    expect(hasErrors(errors)).toBe(true);
    expect(hasErrors({})).toBe(false);
  });
});
