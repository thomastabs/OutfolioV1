import packageJson from '@/package.json';

describe('deployment package scripts', () => {
  it('generates Prisma Client before the Next.js production build', () => {
    expect(packageJson.scripts.build).toMatch(/^prisma generate && next build$/);
  });
});
