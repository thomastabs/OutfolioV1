import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Story 9552562 accessibility requirements', () => {
  it('defines visible keyboard focus outlines for shared interactive components', () => {
    const styles = readProjectFile('app/styles/colors-shapes.css');
    const formStyles = readProjectFile('app/styles/forms.css');

    expect(styles).toContain('--focus-outline-color');
    expect(styles).toContain('--focus-outline-width');
    expect(styles).toContain('outline: var(--focus-outline-width) solid var(--focus-outline-color)');
    expect(styles).toContain('button:focus-visible');
    expect(formStyles).toContain('input:focus-visible');
    expect(formStyles).toContain('select:focus-visible');
    expect(formStyles).toContain('outline: var(--focus-outline-width) solid var(--focus-outline-color)');
  });

  it('provides semantic heading structure on primary pages', () => {
    const homePage = readProjectFile('app/page.tsx');
    const discoveryPage = readProjectFile('app/discover/page.tsx');
    const projectsPage = readProjectFile('app/projects/page.tsx');
    const publicProfilePage = readProjectFile('app/developer/[username]/page.tsx');

    expect(homePage).toContain('<h1 className=');
    expect(homePage).toContain('{data.productName}</h1>');
    expect(homePage).toContain('id="home-highlights-heading"');
    expect(homePage).toContain('Published project highlights');
    expect(discoveryPage).toContain('Discover projects</h1>');
    expect(discoveryPage).toContain('<h2 id="discovery-filters-heading"');
    expect(discoveryPage).toContain('<h2 id="discovery-results-heading"');
    expect(projectsPage).toContain('Project management workspace</h1>');
    expect(projectsPage).toContain('<h2 id="project-editor-heading"');
    expect(projectsPage).toContain('<h2 id="project-list-heading"');
    expect(publicProfilePage).toContain('{data.profile.name || data.username}');
    expect(publicProfilePage).toContain('Published projects</h2>');
  });

  it('associates form controls with accessible labels across user-facing forms', () => {
    const registrationForm = readProjectFile('app/register/RegistrationForm.tsx');
    const loginForm = readProjectFile('app/login/LoginForm.tsx');
    const profileEditor = readProjectFile('app/profile/ProfileEditor.tsx');
    const projectEditor = readProjectFile('app/projects/ProjectEditor.tsx');

    [
      ['RegistrationForm', registrationForm, ['name', 'username', 'email', 'password']],
      ['LoginForm', loginForm, ['login-username', 'login-password']],
      ['ProfileEditor', profileEditor, ['profile-name', 'profile-bio', 'profile-experience', 'profile-certifications', 'profile-links', 'profile-visibility']],
      ['ProjectEditor', projectEditor, ['project-title', 'project-summary', 'project-role', 'project-type', 'project-status', 'project-tags', 'project-cover', 'project-problem', 'project-features', 'project-technical-notes', 'project-contribution', 'project-outcome', 'project-visibility']],
    ].forEach(([label, source, ids]) => {
      (ids as string[]).forEach((id) => {
        expect(source as string).toContain(`htmlFor="${id}"`);
      });
    });
  });

  it('uses screen-reader live regions and visually distinct icons for validation and empty states', () => {
    const validationMessage = readProjectFile('app/components/ValidationMessage.tsx');
    const emptyState = readProjectFile('app/components/EmptyState.tsx');
    const registrationForm = readProjectFile('app/register/RegistrationForm.tsx');
    const loginForm = readProjectFile('app/login/LoginForm.tsx');
    const profileEditor = readProjectFile('app/profile/ProfileEditor.tsx');
    const projectEditor = readProjectFile('app/projects/ProjectEditor.tsx');
    const styles = readProjectFile('app/styles/colors-shapes.css');

    expect(validationMessage).toContain('aria-live={type ===');
    expect(validationMessage).toContain('validation-message__icon');
    expect(emptyState).toContain('aria-live="polite"');
    expect(emptyState).toContain('empty-state__icon');
    expect(registrationForm).toContain('ValidationMessage');
    expect(loginForm).toContain('ValidationMessage');
    expect(profileEditor).toContain('ValidationMessage');
    expect(projectEditor).toContain('ValidationMessage');
    expect(styles).toContain('.validation-message__icon');
    expect(styles).toContain('.empty-state__icon');
  });
});
