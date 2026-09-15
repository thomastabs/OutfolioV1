import fs from 'node:fs';
import path from 'node:path';

describe('Profile Prisma schema', () => {
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  it('defines the Profile model and relation to User', () => {
    expect(schema).toMatch(/model Profile\s*{/);
    expect(schema).toMatch(/userId\s+String\s+@id/);
    expect(schema).toMatch(/user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
    expect(schema).toMatch(/profile\s+Profile\?/);
  });

  it('defines the required profile fields', () => {
    expect(schema).toMatch(/name\s+String/);
    expect(schema).toMatch(/bio\s+String/);
    expect(schema).toMatch(/experienceYears\s+Int/);
    expect(schema).toMatch(/certifications\s+String\[\]/);
    expect(schema).toMatch(/links\s+String\[\]/);
    expect(schema).toMatch(/visibility\s+ProfileVisibility/);
  });

  it('defines visibility values mapped to public, private, and unlisted', () => {
    expect(schema).toMatch(/enum ProfileVisibility\s*{/);
    expect(schema).toMatch(/PUBLIC\s+@map\("public"\)/);
    expect(schema).toMatch(/PRIVATE\s+@map\("private"\)/);
    expect(schema).toMatch(/UNLISTED\s+@map\("unlisted"\)/);
  });
});
