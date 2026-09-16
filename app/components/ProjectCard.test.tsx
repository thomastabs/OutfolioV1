import { render, screen } from '@testing-library/react';

import { ProjectCard } from './ProjectCard';

describe('ProjectCard', () => {
  it('renders title and summary with themed card styling', () => {
    render(<ProjectCard title="Case Study" summary="A project summary." href="/project/case-study" />);

    const card = screen.getByRole('article');
    expect(card).toHaveClass('project-card');
    expect(screen.getByRole('heading', { name: 'Case Study' })).toBeInTheDocument();
    expect(screen.getByText('A project summary.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Case Study' })).toHaveAttribute('href', '/project/case-study');
  });

  it('handles a missing summary gracefully', () => {
    render(<ProjectCard title="No Summary" />);

    expect(screen.getByRole('heading', { name: 'No Summary' })).toBeInTheDocument();
    expect(screen.queryByText('No summary available.')).not.toBeInTheDocument();
  });
});
