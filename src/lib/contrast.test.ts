import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_LARGE_TEXT, WCAG_AA_TEXT } from './contrast';

describe('contrastRatio', () => {
  it('is 21:1 for black on white, the maximum possible ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('is 1:1 for a color against itself', () => {
    expect(contrastRatio('#1baf7a', '#1baf7a')).toBeCloseTo(1, 5);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio('#0b0b0b', '#fcfcfb')).toBeCloseTo(contrastRatio('#fcfcfb', '#0b0b0b'), 5);
  });

  it('matches a known WCAG example (white text on a mid-gray #767676 is ~4.5:1)', () => {
    expect(contrastRatio('#ffffff', '#767676')).toBeCloseTo(4.5, 1);
  });

  it('exposes the AA thresholds used to gate real tokens', () => {
    expect(WCAG_AA_TEXT).toBe(4.5);
    expect(WCAG_AA_LARGE_TEXT).toBe(3);
  });
});
