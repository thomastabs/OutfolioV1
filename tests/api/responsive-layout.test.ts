import fs from 'fs';
import path from 'path';

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Responsive layout implementation', () => {
  it('defines mobile, tablet, and desktop responsive layout rules', () => {
    const source = readAppFile('app/styles/forms.css');

    expect(source).toContain('@media (max-width: 640px)');
    expect(source).toContain('@media (min-width: 641px) and (max-width: 1024px)');
    expect(source).toContain('@media (min-width: 1025px)');
    expect(source).toContain('.page-shell');
    expect(source).toContain('.responsive-form');
    expect(source).toContain('.responsive-card-grid');
    expect(source).toContain('.responsive-controls');
    expect(source).toContain('overflow-wrap: anywhere');
  });

  it('adds responsive hooks to authentication pages and forms', () => {
    expect(readAppFile('app/register/page.tsx')).toContain('className="page-shell auth-page"');
    expect(readAppFile('app/login/page.tsx')).toContain('className="page-shell auth-page"');
    expect(readAppFile('app/register/RegistrationForm.tsx')).toContain('className="responsive-form auth-form"');
    expect(readAppFile('app/login/LoginForm.tsx')).toContain('className="responsive-form auth-form"');
  });

  it('adds responsive hooks to profile and project management pages', () => {
    expect(readAppFile('app/profile/page.tsx')).toContain('min-h-screen bg-background');
    expect(readAppFile('app/profile/page.tsx')).toContain('max-w-6xl');
    expect(readAppFile('app/profile/ProfileEditor.tsx')).toContain('md:grid-cols-2');
    expect(readAppFile('app/projects/page.tsx')).toContain('max-w-7xl');
    expect(readAppFile('app/projects/page.tsx')).toContain('aria-live="polite"');
    expect(readAppFile('app/projects/[id]/page.tsx')).toContain('className="page-shell project-edit-page"');
    expect(readAppFile('app/projects/ProjectEditor.tsx')).toContain('md:grid-cols-2');
    expect(readAppFile('app/projects/ProjectList.tsx')).toContain('xl:grid-cols-3');
  });

  it('adds responsive hooks to public profile, public project, and discovery pages', () => {
    expect(readAppFile('app/developer/[username]/page.tsx')).toContain('max-w-6xl');
    expect(readAppFile('app/developer/[username]/page.tsx')).toContain('xl:grid-cols-3');
    expect(readAppFile('app/project/[slug]/page.tsx')).toContain('max-w-6xl');
    expect(readAppFile('app/project/[slug]/page.tsx')).toContain('md:grid-cols-3');
    expect(readAppFile('app/discover/page.tsx')).toContain('max-w-6xl');
    expect(readAppFile('app/discover/page.tsx')).toContain('md:grid-cols-2');
    expect(readAppFile('app/discover/page.tsx')).toContain('xl:grid-cols-3');
  });
});
