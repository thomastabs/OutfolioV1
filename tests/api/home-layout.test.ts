import fs from 'fs';
import path from 'path';

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Home dashboard layout', () => {
  it('keeps published project highlights visually separated from the hero actions', () => {
    const source = readAppFile('app/styles/forms.css');

    expect(source).toContain('.home-page');
    expect(source).toContain('.home-highlights');
    expect(source).toContain('margin-top: var(--space-xl)');
  });
});
