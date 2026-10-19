import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'styles.css'), 'utf-8');

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`rule not found for ${selector}`);
  return match[1] as string;
}

describe('dashboard chart scope label (L7)', () => {
  it('is styled by a class with token spacing, not inline styles', () => {
    const body = ruleBody('.chart-scope');
    expect(body).toMatch(/margin:\s*var\(--space-4\)\s+0\s+var\(--space-3\)/);
  });
});

describe('KPI grid on narrow screens (L9)', () => {
  it('keeps the four KPI cards in a 2x2 grid at 360px instead of stacking them', () => {
    expect(ruleBody('.grid-kpi')).toMatch(/repeat\(4,/);
    const mediaRules = [...css.matchAll(/@media \(max-width: (\d+)px\) \{\s*\.grid-kpi \{([^}]*)\}/g)];
    expect(mediaRules.length).toBeGreaterThan(0);
    for (const [, maxWidth, body] of mediaRules) {
      expect(Number(maxWidth)).toBeGreaterThanOrEqual(480);
      expect(body).toMatch(/repeat\(2,/);
    }
  });
});
