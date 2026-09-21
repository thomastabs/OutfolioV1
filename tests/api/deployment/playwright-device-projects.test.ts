import fs from 'fs';
import path from 'path';

describe('Playwright real-device viewport projects (Story 9563524)', () => {
  const configPath = path.join(process.cwd(), 'playwright.config.ts');
  const source = fs.readFileSync(configPath, 'utf8');

  it('configures a desktop project plus real iPhone and iPad device emulations', () => {
    expect(source).toContain(`name: 'chromium'`);
    expect(source).toContain(`devices['Desktop Chrome']`);
    expect(source).toContain(`name: 'iPhone 13'`);
    expect(source).toContain(`devices['iPhone 13']`);
    expect(source).toContain(`name: 'iPad Pro 11'`);
    expect(source).toContain(`devices['iPad Pro 11']`);
  });

  it('does not reference the nonexistent "iPad Pro" device key', () => {
    // Playwright's device registry has no plain "iPad Pro" entry - only
    // suffixed variants like "iPad Pro 11". Referencing the bare name
    // would spread `undefined` into a project's `use` config at runtime.
    expect(source).not.toMatch(/devices\['iPad Pro'\]/);
  });

  it('scopes the device-emulation projects to the responsive-layout spec only', () => {
    // Without this, the golden-path and smoke specs would run three times
    // (once per device project) and re-exercise full auth flows on every
    // device, instead of just the responsive-layout checks that actually
    // care about viewport/device differences.
    const projectBlocks = source.split(/\{\s*\n\s*name:/).slice(1);
    const iPhoneBlock = projectBlocks.find((block) => block.startsWith(` 'iPhone 13'`));
    const iPadBlock = projectBlocks.find((block) => block.startsWith(` 'iPad Pro 11'`));

    expect(iPhoneBlock).toContain('testMatch');
    expect(iPhoneBlock).toMatch(/responsive-layout/);
    expect(iPadBlock).toContain('testMatch');
    expect(iPadBlock).toMatch(/responsive-layout/);
  });
});
