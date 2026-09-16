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
    expect(readAppFile('app/profile/page.tsx')).toContain('className="page-shell profile-page"');
    expect(readAppFile('app/profile/ProfileEditor.tsx')).toContain('className="responsive-form profile-editor-form"');
    expect(readAppFile('app/projects/page.tsx')).toContain('className="page-shell projects-page"');
    expect(readAppFile('app/projects/[id]/page.tsx')).toContain('className="page-shell project-edit-page"');
    expect(readAppFile('app/projects/ProjectEditor.tsx')).toContain('className="responsive-form project-editor-form"');
    expect(readAppFile('app/projects/ProjectList.tsx')).toContain('className="responsive-card-grid project-list-grid"');
  });

  it('adds responsive hooks to public profile, public project, and discovery pages', () => {
    expect(readAppFile('app/developer/[username]/page.tsx')).toContain('className="page-shell public-profile-page"');
    expect(readAppFile('app/project/[slug]/page.tsx')).toContain('className="page-shell public-project-page"');
    expect(readAppFile('app/discover/page.tsx')).toContain('className="page-shell discovery-page"');
    expect(readAppFile('app/discover/page.tsx')).toContain('className="responsive-controls discovery-controls"');
    expect(readAppFile('app/discover/page.tsx')).toContain('className="responsive-card-grid discovery-results"');
  });
});
