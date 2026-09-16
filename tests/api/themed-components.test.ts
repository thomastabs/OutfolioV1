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

  it('defines themed button states using CSS variables', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain('.button');
    expect(source).toContain('.button:hover');
    expect(source).toContain('.button:focus-visible');
    expect(source).toContain('.button:active');
    expect(source).toContain('.button:disabled');
    expect(source).toContain('[aria-disabled="true"]');
  });

  it('defines themed input, textarea, navigation, card, empty, and validation styles', () => {
    const source = readAppFile('app/styles/colors-shapes.css');

    expect(source).toContain('.form-input');
    expect(source).toContain('.form-input:hover');
    expect(source).toContain('.form-input:focus-visible');
    expect(source).toContain('.form-input:disabled');
    expect(source).toContain('.navigation-link');
    expect(source).toContain('.navigation-link:hover');
    expect(source).toContain('.project-card');
    expect(source).toContain('.project-card:focus-visible');
    expect(source).toContain('.empty-state');
    expect(source).toContain('.validation-message');
    expect(source).toContain('.validation-message--warning');
  });
});
