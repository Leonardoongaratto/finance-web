import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf-8');
const mainTsx = readFileSync(resolve(here, 'main.tsx'), 'utf-8');
const stylesCss = readFileSync(resolve(here, 'styles.css'), 'utf-8');

/** Any reference to an external origin that would defeat offline use (AC-D8). */
const EXTERNAL_URL = /(?:url\(|@import\s+|href=["'])https?:\/\//i;

describe('AC-D8: Inter is bundled with the app, never fetched from a CDN', () => {
  it('imports the self-hosted @fontsource/inter stylesheets for the weights the design uses (400/500/600)', () => {
    for (const weight of ['400', '500', '600']) {
      expect(mainTsx).toContain(`@fontsource/inter/${weight}.css`);
    }
  });

  it('sets the body font-family to start with Inter', () => {
    const match = stylesCss.match(/body\s*\{[^}]*font-family:\s*([^;]+);/s);
    expect(match, 'body { font-family } not found in styles.css').not.toBeNull();
    const firstFamily = (match as RegExpMatchArray)[1]?.split(',')[0]?.trim();
    expect(firstFamily).toBe("'Inter'");
  });

  it('has no external font/stylesheet link, @import, or url() pointing at http(s) in index.html', () => {
    expect(EXTERNAL_URL.test(indexHtml)).toBe(false);
  });

  it('has no external url() or @import in styles.css (fonts resolve to the bundled package, not a CDN)', () => {
    expect(EXTERNAL_URL.test(stylesCss)).toBe(false);
  });

  it('never imports a fontsource stylesheet from a CDN specifier (bare package import only)', () => {
    const fontImports = [...mainTsx.matchAll(/import\s+['"]([^'"]*fontsource[^'"]*)['"]/g)].map((m) => m[1]);
    expect(fontImports.length).toBeGreaterThan(0);
    for (const specifier of fontImports) {
      expect(specifier?.startsWith('@fontsource/')).toBe(true);
      expect(specifier).not.toMatch(/^https?:\/\//);
    }
  });
});
