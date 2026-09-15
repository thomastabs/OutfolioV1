import fs from 'node:fs';
import path from 'node:path';

describe('Project Prisma schema', () => {
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  it('defines Project with owner relation and per-owner slug uniqueness', () => {
    expect(schema).toMatch(/model Project\s*{/);
    expect(schema).toMatch(/ownerId\s+String/);
    expect(schema).toMatch(/owner\s+User\s+@relation\(fields: \[ownerId\], references: \[id\], onDelete: Cascade\)/);
    expect(schema).toMatch(/@@unique\(\[ownerId, slug\]\)/);
    expect(schema).toMatch(/projects\s+Project\[\]/);
  });

  it('defines required project creation fields and visibility values', () => {
    expect(schema).toMatch(/title\s+String/);
    expect(schema).toMatch(/slug\s+String/);
    expect(schema).toMatch(/summary\s+String/);
    expect(schema).toMatch(/role\s+String/);
    expect(schema).toMatch(/visibility\s+ProjectVisibility\s+@default\(DRAFT\)/);
    expect(schema).toMatch(/DRAFT\s+@map\("draft"\)/);
    expect(schema).toMatch(/PUBLISHED\s+@map\("published"\)/);
    expect(schema).toMatch(/UNPUBLISHED\s+@map\("unpublished"\)/);
  });
});
