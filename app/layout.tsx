import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import './styles/globals.css';
import './styles/typography-spacing.css';
import './styles/colors-shapes.css';
import './styles/forms.css';

export const metadata: Metadata = {
  title: 'Outfolio',
  description: 'Portfolio case studies for OutSystems developers',
};

type RootLayoutProps = {
  children: ReactNode;
};

// Story 9564192: applies the persisted (or system) theme to <html> before
// the page paints. A React effect alone (in ThemeSwitcher) runs after
// first paint/hydration, which would flash the light theme on every load
// before switching to dark - this blocking inline script runs first.
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme-preference');var m=(s==='light'||s==='dark'||s==='system')?s:'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="fixed right-4 top-4 z-50">
          <ThemeSwitcher />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
