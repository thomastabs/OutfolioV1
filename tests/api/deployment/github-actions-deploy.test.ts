import fs from 'fs';
import path from 'path';

describe('GitHub Actions deployment workflow', () => {
  const workflowPath = path.join(process.cwd(), '.github/workflows/deploy.yml');

  it('defines a main-branch deployment workflow for Vercel', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);

    const source = fs.readFileSync(workflowPath, 'utf8');

    expect(source).toContain('name: Deploy Outfolio');
    expect(source).toContain('branches: [main]');
    expect(source).toContain('pnpm/action-setup');
    expect(source).toContain('node-version: 20');
    expect(source).toContain('pnpm install --frozen-lockfile');
    expect(source).toContain('pnpm test');
    expect(source).toContain('pnpm build');
    expect(source).toContain('--project="$VERCEL_PROJECT_ID"');
    expect(source).toContain('--scope="$VERCEL_SCOPE"');
    expect(source).toContain('vercel deploy --prod');
  });

  it('runs database migrations against the pulled production environment before deploying', () => {
    const source = fs.readFileSync(workflowPath, 'utf8');

    const pullIndex = source.indexOf('vercel pull');
    const migrateIndex = source.indexOf('prisma migrate deploy');
    const deployIndex = source.indexOf('vercel deploy --prod');

    expect(pullIndex).toBeGreaterThan(-1);
    expect(migrateIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBeGreaterThan(-1);
    expect(migrateIndex).toBeGreaterThan(pullIndex);
    expect(deployIndex).toBeGreaterThan(migrateIndex);
    expect(source).toContain('.vercel/.env.production.local');
  });

  it('references deployment secrets without committing secret values', () => {
    const source = fs.readFileSync(workflowPath, 'utf8');

    expect(source).toContain('VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}');
    expect(source).toContain('VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}');
    expect(source).toContain('VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}');
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*:\s*(?!\$\{\{ secrets\.)\S+/);
    expect(source).not.toMatch(/NEXTAUTH_SECRET\s*:\s*(?!\$\{\{ secrets\.)\S+/);
  });
});
