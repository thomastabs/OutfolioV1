import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
