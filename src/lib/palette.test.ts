import { describe, expect, it } from 'vitest';
import { paletteFor } from './palette';

describe('paletteFor', () => {
  it('has distinct palettes for each theme with enough category colors', () => {
    const light = paletteFor('light');
    const dark = paletteFor('dark');
    expect(light.textPrimary).not.toBe(dark.textPrimary);
    expect(light.categories.length).toBeGreaterThanOrEqual(7);
    expect(new Set(dark.categories).size).toBe(dark.categories.length);
    for (const palette of [light, dark]) expect(palette.debtProjection).toBe(palette.debt);
  });

  it('never reuses the brand accent or a status color as a categorical series color (AC-D4)', () => {
    for (const palette of [paletteFor('light'), paletteFor('dark')]) {
      expect(palette.categories).not.toContain(palette.accent);
      expect(palette.categories).not.toContain(palette.statusGood);
      expect(palette.categories).not.toContain(palette.statusWarning);
      expect(palette.categories).not.toContain(palette.statusSerious);
      expect(palette.categories).not.toContain(palette.statusCritical);
    }
  });

  it('keeps the dark critical status from colliding with the dark categorical red slot (B-03)', () => {
    const dark = paletteFor('dark');
    expect(dark.statusCritical).not.toBe(dark.categories.at(-1));
  });

  it('keeps axis/text tokens distinct from the accent and status colors (AC-D6)', () => {
    for (const palette of [paletteFor('light'), paletteFor('dark')]) {
      expect(palette.axis).not.toBe(palette.accent);
      expect(palette.axis).not.toBe(palette.statusWarning);
      expect(palette.textPrimary).not.toBe(palette.accent);
    }
  });
});
