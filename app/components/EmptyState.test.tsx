import { render, screen } from '@testing-library/react';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the default themed empty state message', () => {
    render(<EmptyState />);

    const status = screen.getByRole('status');
    expect(status).toHaveClass('empty-state');
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
  });

  it('renders a custom message with optional actions', () => {
    render(
      <EmptyState message="No projects yet.">
        <a href="/projects/new">Create project</a>
      </EmptyState>,
    );

    expect(screen.getByText('No projects yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create project' })).toHaveAttribute('href', '/projects/new');
  });
});
