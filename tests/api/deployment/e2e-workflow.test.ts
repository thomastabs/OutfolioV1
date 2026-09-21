import fs from 'fs';
import path from 'path';

describe('E2E test workflow', () => {
  const workflowPath = path.join(process.cwd(), '.github/workflows/e2e.yml');
  const deployWorkflowPath = path.join(process.cwd(), '.github/workflows/deploy.yml');

  it('defines a separate workflow from the production deploy pipeline', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);

    const source = fs.readFileSync(workflowPath, 'utf8');

    expect(source).toContain('name: E2E Tests');
    expect(source).not.toContain('vercel deploy');
    expect(source).not.toContain('VERCEL_TOKEN');

    const deploySource = fs.readFileSync(deployWorkflowPath, 'utf8');
    expect(deploySource).not.toContain('playwright');
  });

  it('uses isolated TEST_* secrets rather than the production database or Supabase project', () => {
    const source = fs.readFileSync(workflowPath, 'utf8');

    expect(source).toContain('DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}');
    expect(source).toContain('SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}');
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}');
    expect(source).toContain('NEXTAUTH_SECRET: ${{ secrets.TEST_NEXTAUTH_SECRET }}');
    expect(source).not.toMatch(/DATABASE_URL:\s*\$\{\{\s*secrets\.DATABASE_URL\s*\}\}/);
  });

  it('runs the harness steps in the correct order: migrate, seed, build, start, then test', () => {
    const source = fs.readFileSync(workflowPath, 'utf8');

    const migrateIndex = source.indexOf('prisma migrate deploy');
    const seedIndex = source.indexOf('pnpm seed:test-db');
    const buildIndex = source.indexOf('pnpm build');
    const startIndex = source.indexOf('pnpm start');
    const waitIndex = source.indexOf('Server did not become ready');
    const testIndex = source.indexOf('pnpm test:e2e');

    expect(migrateIndex).toBeGreaterThan(-1);
    expect(seedIndex).toBeGreaterThan(migrateIndex);
    expect(buildIndex).toBeGreaterThan(seedIndex);
    expect(startIndex).toBeGreaterThan(buildIndex);
    expect(waitIndex).toBeGreaterThan(startIndex);
    expect(testIndex).toBeGreaterThan(waitIndex);
  });

  it('pins the runner image rather than using the floating ubuntu-latest alias', () => {
    const source = fs.readFileSync(workflowPath, 'utf8');

    expect(source).not.toContain('runs-on: ubuntu-latest');
    expect(source).toMatch(/runs-on: ubuntu-\d+\.\d+/);
  });
});
