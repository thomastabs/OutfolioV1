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

  it('makes icons inside primary (green) buttons follow the button text color instead of the fixed icon-color token', () => {
    const globals = readProjectFile('app/styles/globals.css');

    expect(globals).toContain('.text-primary-foreground svg');
    expect(globals).toContain('.text-primary-foreground .icon');
    expect(globals).toContain('color: inherit');
  });
});

describe('Story 9564192 dark mode support and theme switching', () => {
  it('defines a .dark override for every shadcn/ui token declared on :root', () => {
    const globals = readProjectFile('app/styles/globals.css');
    const rootBlock = globals.match(/:root\s*{([^}]*)}/)?.[1] ?? '';
    const darkBlock = globals.match(/\.dark\s*{([^}]*)}/)?.[1] ?? '';

    const rootTokens = Array.from(rootBlock.matchAll(/--([a-z-]+):/g), (match) => match[1]);
    expect(rootTokens.length).toBeGreaterThan(0);

    for (const token of rootTokens) {
      if (token === 'radius') continue; // shape, not a color - has no dark variant
      expect(darkBlock).toContain(`--${token}:`);
    }
  });

  it('defines a .dark override for every --color-* token declared on :root in colors-shapes.css, since its plain rules take cascade priority over globals.css\'s @layer base rules', () => {
    const colorsShapes = readProjectFile('app/styles/colors-shapes.css');
    const rootMatches = Array.from(colorsShapes.matchAll(/:root\s*{([^}]*)}/gs));
    const rootBlock = rootMatches[0]?.[1] ?? '';
    const darkBlock = colorsShapes.match(/\.dark\s*{([^}]*)}/s)?.[1] ?? '';

    const literalColorTokens = Array.from(
      rootBlock.matchAll(/--(color-[a-z-]+):(?!\s*var\()/g),
      (match) => match[1],
    );
    expect(literalColorTokens.length).toBeGreaterThan(0);

    for (const token of literalColorTokens) {
      expect(darkBlock).toContain(`--${token}:`);
    }
  });

  it('renders the ThemeSwitcher in the root layout so it appears on every page', () => {
    const layout = readProjectFile('app/layout.tsx');

    expect(layout).toContain('ThemeSwitcher');
  });
});
