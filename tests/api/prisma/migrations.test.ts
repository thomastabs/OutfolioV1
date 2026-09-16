import fs from 'fs';
import path from 'path';

describe('Prisma migration order', () => {
  const migrationsDir = path.join(process.cwd(), 'prisma/migrations');

  it('creates the User table before migrations add Profile and Project foreign keys', () => {
    const migrationNames = fs
      .readdirSync(migrationsDir)
      .filter((name) => fs.statSync(path.join(migrationsDir, name)).isDirectory())
      .sort();

    const userMigrationIndex = migrationNames.findIndex((name) => name.includes('create_user_entity'));
    const profileMigrationIndex = migrationNames.findIndex((name) => name.includes('add_profile_entity'));
    const projectMigrationIndex = migrationNames.findIndex((name) => name.includes('add_project_entity'));

    expect(userMigrationIndex).toBeGreaterThanOrEqual(0);
    expect(profileMigrationIndex).toBeGreaterThan(userMigrationIndex);
    expect(projectMigrationIndex).toBeGreaterThan(userMigrationIndex);

    const userMigrationSql = fs.readFileSync(
      path.join(migrationsDir, migrationNames[userMigrationIndex], 'migration.sql'),
      'utf8',
    );

    expect(userMigrationSql).toContain('CREATE TABLE "User"');
    expect(userMigrationSql).toContain('CONSTRAINT "User_pkey" PRIMARY KEY ("id")');
    expect(userMigrationSql).toContain('CONSTRAINT "User_username_key" UNIQUE ("username")');
    expect(userMigrationSql).toContain('CONSTRAINT "User_email_key" UNIQUE ("email")');
  });
});
