import fs from 'fs';
import path from 'path';

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Themed UI component styles', () => {
  it('defines reusable theme tokens for colors, typography, spacing, and states', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain(':root');
    expect(source).toContain('--color-primary');
    expect(source).toContain('--color-secondary');
    expect(source).toContain('--color-accent');
    expect(source).toContain('--color-warning');
    expect(source).toContain('--color-background');
    expect(source).toContain('--color-text');
    expect(source).toContain('--font-family-sans');
    expect(source).toContain('--component-gap');
    expect(source).toContain('--button-padding-block');
    expect(source).toContain('--shadow-card');
  });

  it('defines themed empty and validation styles', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain('.empty-state');
    expect(source).toContain('.validation-message');
    expect(source).toContain('.validation-message--warning');
  });
});
