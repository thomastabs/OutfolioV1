import { render, screen } from '@testing-library/react';

import { NavigationLink } from './NavigationLink';

describe('NavigationLink', () => {
  it('renders an accessible themed link', () => {
    render(<NavigationLink href="/discover">Discover</NavigationLink>);

    const link = screen.getByRole('link', { name: 'Discover' });
    expect(link).toHaveAttribute('href', '/discover');
    expect(link).toHaveClass('navigation-link');
  });

  it('passes through custom class names and props', () => {
    render(
      <NavigationLink href="/profile" className="profile-link" data-testid="profile-link">
        Profile
      </NavigationLink>,
    );

    const link = screen.getByTestId('profile-link');
    expect(link).toHaveClass('navigation-link');
    expect(link).toHaveClass('profile-link');
  });

  it('renders disabled navigation without an active href', () => {
    render(
      <NavigationLink href="/projects" disabled>
        Projects
      </NavigationLink>,
    );

    const link = screen.getByText('Projects');
    expect(link).not.toHaveAttribute('href');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabIndex', '-1');
  });
});
