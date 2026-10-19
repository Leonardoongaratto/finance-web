import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_TEXT } from './lib/contrast';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'styles.css'), 'utf-8');

function tokensFromFirstBlock(selector: RegExp): Record<string, string> {
  const match = css.match(selector);
  if (!match) throw new Error(`block not found for ${selector}`);
  const tokens: Record<string, string> = {};
  for (const [, name, hex] of match[0].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    if (name && hex) tokens[name] = hex;
  }
  return tokens;
}

// The first bare `:root { ... }` block holds the light tokens; the
// `:root[data-theme='dark']` block holds the dark ones. Reading the actual
// file (not re-typing the hexes here) is what makes this a regression test
// for AC-D6/BUG-02 instead of a tautology (B-04): it fails the moment
// someone points a text token back at a low-contrast fill.
const light = tokensFromFirstBlock(/:root\s*\{[^}]*\}/);
const dark = tokensFromFirstBlock(/:root\[data-theme=['"]dark['"]\]\s*\{[^}]*\}/);

describe('AC-D6: text tokens meet WCAG AA (>= 4.5:1) against the background they actually render on', () => {
  const pairs: [string, string, string][] = [
    ['warning text on its badge background', 'text-warning', 'status-warning-bg'],
    ['success text on its badge background', 'text-success', 'status-good-bg'],
    ['danger text on its badge background', 'text-danger', 'status-critical-bg'],
    ['accent text on the page surface', 'text-accent', 'surface-1'],
    ['accent text on the accent-tinted badge background', 'text-accent', 'accent-bg'],
    ['button/nav text on the filled accent background', 'on-accent', 'accent'],
    ['primary ink on the page surface', 'text-primary', 'surface-1'],
    ['secondary ink on the page surface', 'text-secondary', 'surface-1'],
  ];

  it.each(pairs)('%s (light)', (_label, fg, bg) => {
    const foreground = light[fg];
    const background = light[bg];
    expect(foreground, `--${fg} missing from the light :root block`).toBeDefined();
    expect(background, `--${bg} missing from the light :root block`).toBeDefined();
    expect(contrastRatio(foreground as string, background as string)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it.each(pairs)('%s (dark)', (_label, fg, bg) => {
    const foreground = dark[fg];
    const background = dark[bg];
    expect(foreground, `--${fg} missing from the dark :root block`).toBeDefined();
    expect(background, `--${bg} missing from the dark :root block`).toBeDefined();
    expect(contrastRatio(foreground as string, background as string)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});
