import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectHighlightCard, type ProjectHighlight } from './ProjectHighlightCard';

const publishedProject: ProjectHighlight = {
  id: 'project-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A documentation workspace for portfolio projects.',
  coverImageUrl: 'https://example.com/portfolio-cover.png',
  projectType: 'Web app',
  tags: ['portfolio', 'documentation'],
  role: 'Full-stack developer',
  visibility: 'PUBLISHED',
};

describe('ProjectHighlightCard', () => {
  it('renders a project cover image, metadata, summary, and public CTA', () => {
    render(<ProjectHighlightCard project={publishedProject} />);

    expect(screen.getByRole('img', { name: 'Portfolio Builder cover image' })).toHaveAttribute(
      'src',
      'https://example.com/portfolio-cover.png',
    );
    expect(screen.getByRole('heading', { name: 'Portfolio Builder' })).toBeInTheDocument();
    expect(screen.getByText('A documentation workspace for portfolio projects.')).toBeInTheDocument();

    const metadata = screen.getByLabelText('Project metadata for Portfolio Builder');
    const tags = screen.getByLabelText('Tags for Portfolio Builder');
    expect(within(metadata).getByText('Web app')).toBeInTheDocument();
    expect(within(metadata).getByText('Full-stack developer')).toBeInTheDocument();
    expect(within(tags).getByText('portfolio')).toBeInTheDocument();
    expect(within(tags).getByText('documentation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View full project: Portfolio Builder' })).toHaveAttribute(
      'href',
      '/project/portfolio-builder',
    );
  });

  it('renders a placeholder and omits empty metadata without awkward fallback text', () => {
    render(
      <ProjectHighlightCard
        project={{
          ...publishedProject,
          coverImageUrl: '',
          projectType: '',
          tags: [],
          role: '',
        }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Placeholder image for Portfolio Builder' })).toHaveClass(
      'project-highlight-placeholder',
    );
    expect(screen.queryByLabelText('Project metadata for Portfolio Builder')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tags for Portfolio Builder')).not.toBeInTheDocument();
    expect(screen.queryByText(/No metadata/i)).not.toBeInTheDocument();
  });

  it('falls back to a placeholder when a cover image fails and hides CTA for non-public projects', async () => {
    render(<ProjectHighlightCard project={{ ...publishedProject, visibility: 'DRAFT' }} />);

    fireEvent.error(screen.getByRole('img', { name: 'Portfolio Builder cover image' }));

    expect(await screen.findByRole('img', { name: 'Placeholder image for Portfolio Builder' })).toHaveClass(
      'project-highlight-placeholder',
    );
    expect(screen.queryByRole('link', { name: /View full project/i })).not.toBeInTheDocument();
  });
});
