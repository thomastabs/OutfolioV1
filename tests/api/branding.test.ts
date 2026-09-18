import fs from 'fs';
import path from 'path';

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function getCssVariable(source: string, name: string) {
  const match = source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) {
    throw new Error(`Missing CSS variable ${name}`);
  }
  return match[1];
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function channelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * channelToLinear(r)) + (0.7152 * channelToLinear(g)) + (0.0722 * channelToLinear(b));
}

function contrastRatio(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe('Outfolio branding and color scheme', () => {
  it('defines the full brand palette under global CSS variables', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain(':root');
    expect(source).toContain('--color-primary-dark');
    expect(source).toContain('--color-primary-light');
    expect(source).toContain('--color-secondary-dark');
    expect(source).toContain('--color-secondary-light');
    expect(source).toContain('--color-text-primary');
    expect(source).toContain('--color-text-secondary');
    expect(source).toContain('--color-text-disabled');
    expect(source).toContain('--color-link');
    expect(source).toContain('--color-link-hover');
  });

  it('keeps brand text and interactive colors at WCAG AA contrast on their backgrounds', () => {
    const source = readAppFile('app/styles/colors-shapes.css');
    const white = getCssVariable(source, '--color-surface');
    const background = getCssVariable(source, '--color-background');

    const contrastPairs = [
      ['--color-text-primary', background],
      ['--color-text-secondary', white],
      ['--color-primary', white],
      ['--color-primary-dark', white],
      ['--color-secondary', white],
      ['--color-accent', white],
      ['--color-link', white],
      ['--color-state-published-text', getCssVariable(source, '--color-state-published-bg')],
      ['--color-state-draft-text', getCssVariable(source, '--color-state-draft-bg')],
      ['--color-state-private-text', getCssVariable(source, '--color-state-private-bg')],
      ['--color-state-unlisted-text', getCssVariable(source, '--color-state-unlisted-bg')],
    ];

    for (const [foregroundToken, backgroundColor] of contrastPairs) {
      const foregroundColor = getCssVariable(source, foregroundToken);
      expect(contrastRatio(foregroundColor, backgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('defines distinct branded visual indicator classes for content states', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain('.state-indicator');
    expect(source).toContain('.state-indicator--draft');
    expect(source).toContain('.state-indicator--published');
    expect(source).toContain('.state-indicator--private');
    expect(source).toContain('.state-indicator--unlisted');
    expect(source).toContain('.state-indicator--unpublished');
  });

  it('keeps global surfaces, buttons, and links wired to brand variables', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain('background: var(--color-background)');
    expect(source).toContain('color: var(--color-text-primary)');
    expect(source).toContain('color: var(--color-link)');
    expect(source).toContain('background: var(--color-primary)');
    expect(source).toContain('background: var(--color-primary-dark)');
  });
});
