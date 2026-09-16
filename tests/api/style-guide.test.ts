import fs from 'fs';
import path from 'path';

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Visual style guide CSS', () => {
  it('defines typography and spacing variables globally', () => {
    const source = readAppFile('app/styles/typography-spacing.css');

    expect(source).toContain('--font-size-heading');
    expect(source).toContain('--font-size-body');
    expect(source).toContain('--font-size-caption');
    expect(source).toContain('--font-weight-regular');
    expect(source).toContain('--font-weight-medium');
    expect(source).toContain('--font-weight-bold');
    expect(source).toContain('--line-height-heading');
    expect(source).toContain('--line-height-body');
    expect(source).toContain('--space-sm');
    expect(source).toContain('--space-md');
    expect(source).toContain('--space-lg');
  });

  it('defines color, surface, shape, button, and icon variables globally', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain('--color-primary');
    expect(source).toContain('--color-secondary');
    expect(source).toContain('--color-background');
    expect(source).toContain('--color-surface');
    expect(source).toContain('--color-error');
    expect(source).toContain('--radius-control');
    expect(source).toContain('--button-padding-block');
    expect(source).toContain('--icon-size');
    expect(source).toContain('button');
  });

  it('defines shared form controls and validation states', () => {
    const source = readAppFile('app/styles/forms.css');

    expect(source).toContain('input');
    expect(source).toContain('textarea');
    expect(source).toContain('select');
    expect(source).toContain(':focus-visible');
    expect(source).toContain(':disabled');
    expect(source).toContain('[aria-invalid="true"]');
    expect(source).toContain('[role="alert"]');
    expect(source).toContain('--color-error');
  });

  it('imports the style guide CSS files from the root layout', () => {
    const source = readAppFile('app/layout.tsx');

    expect(source).toContain("import './styles/typography-spacing.css'");
    expect(source).toContain("import './styles/colors-shapes.css'");
    expect(source).toContain("import './styles/forms.css'");
  });
});
