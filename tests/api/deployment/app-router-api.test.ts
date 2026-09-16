import fs from 'fs';
import path from 'path';

describe('App Router API deployment bridge', () => {
  const routePath = path.join(process.cwd(), 'app/api/v1/[...path]/route.ts');

  it('exposes the API v1 catch-all route through the Next.js app router', () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('exports handlers for every HTTP method used by the API v1 contract', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    expect(source).toContain('export async function GET');
    expect(source).toContain('export async function POST');
    expect(source).toContain('export async function PUT');
    expect(source).toContain('export async function DELETE');
  });
});
