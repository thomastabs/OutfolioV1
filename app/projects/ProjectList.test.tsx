import { render, screen } from '@testing-library/react';
import { ProjectList, type ProjectSummary } from './ProjectList';

const projects: ProjectSummary[] = [
  {
    id: 'project-1',
    title: 'Portfolio Builder',
    slug: 'portfolio-builder',
    summary: 'A project documentation workspace.',
    role: 'Developer',
    status: 'draft',
    visibility: 'draft',
  },
];

describe('ProjectList', () => {
  it('shows a loading state', () => {
    render(<ProjectList projects={[]} status="loading" />);

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });

  it('shows an error state', () => {
    render(<ProjectList projects={[]} status="error" />);

    expect(screen.getByText('Projects could not be loaded.')).toBeInTheDocument();
  });

  it('displays draft projects distinctly', () => {
    render(<ProjectList projects={projects} status="ready" />);

    expect(screen.getByText('Portfolio Builder')).toBeInTheDocument();
    expect(screen.getByText('A project documentation workspace.')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});
