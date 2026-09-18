import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Story 9556465 visual polish with Tailwind, shadcn/ui, and lucide-react', () => {
  it('configures Tailwind CSS globally for the Next.js app directory', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      devDependencies?: Record<string, string>;
    };
    const tailwindConfig = readProjectFile('tailwind.config.js');
    const globals = readProjectFile('app/styles/globals.css');
    const layout = readProjectFile('app/layout.tsx');

    expect(packageJson.devDependencies).toEqual(
      expect.objectContaining({
        autoprefixer: expect.any(String),
        postcss: expect.any(String),
        tailwindcss: expect.any(String),
      }),
    );
    expect(existsSync(join(root, 'postcss.config.js'))).toBe(true);
    expect(tailwindConfig).toContain("darkMode: 'class'");
    expect(tailwindConfig).toContain("'./app/**/*.{ts,tsx}'");
    expect(tailwindConfig).toContain("'./src/**/*.{ts,tsx}'");
    expect(globals).toContain('@tailwind base;');
    expect(globals).toContain('@tailwind components;');
    expect(globals).toContain('@tailwind utilities;');
    expect(layout).toContain("import './styles/globals.css';");
  });

  it('adds shadcn-style UI primitives and lucide-react icon integration', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toEqual(
      expect.objectContaining({
        'class-variance-authority': expect.any(String),
        clsx: expect.any(String),
        'lucide-react': expect.any(String),
        'tailwind-merge': expect.any(String),
      }),
    );
    expect(readProjectFile('src/lib/utils.ts')).toContain('twMerge');
    expect(readProjectFile('app/components/ui/button.tsx')).toContain('buttonVariants');
    expect(readProjectFile('app/components/ui/card.tsx')).toContain('Card');
    expect(readProjectFile('app/components/ui/input.tsx')).toContain('Input');
    expect(readProjectFile('app/components/ui/textarea.tsx')).toContain('Textarea');
    expect(readProjectFile('app/components/ui/badge.tsx')).toContain('Badge');
    expect(readProjectFile('app/components/index.ts')).toContain("export { Button");
  });

  it('redesigns the target pages with shadcn/ui imports, lucide icons, and Tailwind visual classes', () => {
    [
      'app/page.tsx',
      'app/projects/page.tsx',
      'app/profile/page.tsx',
      'app/profile/ProfileEditor.tsx',
      'app/discover/page.tsx',
      'app/developer/[username]/page.tsx',
      'app/project/[slug]/page.tsx',
    ].forEach((path) => {
      const source = readProjectFile(path);

      expect(source).toContain('lucide-react');
      expect(source).toMatch(/from ['"]@\/app\/components\/ui\//);
      expect(source).toContain('rounded-');
      expect(source).toContain('shadow');
      expect(source).toContain('text-muted-foreground');
    });
  });

  it('keeps redesigned pages accessible with styled empty/error states and calls to action', () => {
    const homePage = readProjectFile('app/page.tsx');
    const projectsPage = readProjectFile('app/projects/page.tsx');
    const profilePage = readProjectFile('app/profile/page.tsx');
    const discoveryPage = readProjectFile('app/discover/page.tsx');
    const publicProfilePage = readProjectFile('app/developer/[username]/page.tsx');
    const publicProjectPage = readProjectFile('app/project/[slug]/page.tsx');

    expect(homePage).toContain('aria-labelledby="home-highlights-heading"');
    expect(homePage).toContain('Register to add yours');
    expect(projectsPage).toContain('aria-live="polite"');
    expect(profilePage).toContain('No profile has been created yet.');
    expect(discoveryPage).toContain('No published projects found');
    expect(publicProfilePage).toContain('No published projects yet.');
    expect(publicProjectPage).toContain('Project not found');
    expect(publicProjectPage).toContain('Back to discovery');
  });
});
