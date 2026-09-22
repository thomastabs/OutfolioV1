import fs from 'fs';
import path from 'path';

// The root layout renders <html>/<head>/<body> itself, which
// react-testing-library can't mount into an existing jsdom document (it
// already has its own html/head/body) - so this verifies the file's
// structure directly, matching this repo's existing convention for
// config/structural files (e.g. tests/api/deployment/app-router-api.test.ts).
describe('app/layout.tsx (Story 9564192: dark mode integration)', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/layout.tsx'), 'utf8');

  it('renders the ThemeSwitcher so it is present on every page', () => {
    expect(source).toContain("import { ThemeSwitcher } from './components/ThemeSwitcher'");
    expect(source).toContain('<ThemeSwitcher />');
  });

  it('applies the persisted or system theme before paint via a blocking inline script, to avoid a flash of the wrong theme', () => {
    expect(source).toContain('dangerouslySetInnerHTML');
    expect(source).toContain('theme-preference');
    expect(source).toContain('prefers-color-scheme: dark');
    expect(source).toContain("document.documentElement.classList.add('dark')");
  });

  it('suppresses the hydration warning on <html>, since the inline script mutates its class before React hydrates', () => {
    expect(source).toMatch(/<html[^>]*\bsuppressHydrationWarning\b/);
  });
});
