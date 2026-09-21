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

  it('trims whitespace from project type, role, and tag metadata before rendering', () => {
    render(
      <ProjectHighlightCard
        project={{
          ...publishedProject,
          projectType: '  Web app  ',
          role: '  Full-stack developer  ',
          tags: ['  portfolio  ', '   ', 'documentation'],
        }}
      />,
    );

    const metadata = screen.getByLabelText('Project metadata for Portfolio Builder');
    const tags = screen.getByLabelText('Tags for Portfolio Builder');
    expect(within(metadata).getByText('Web app')).toBeInTheDocument();
    expect(within(metadata).getByText('Full-stack developer')).toBeInTheDocument();
    expect(within(tags).getByText('portfolio')).toBeInTheDocument();
    expect(within(tags).getByText('documentation')).toBeInTheDocument();
    expect(within(tags).getAllByRole('generic').filter((el) => el.textContent === '')).toHaveLength(0);
  });

  it('renders metadata fields containing special characters as-is', () => {
    render(
      <ProjectHighlightCard
        project={{
          ...publishedProject,
          projectType: 'C++/AI',
          role: 'Lead & Architect',
          tags: ['R&D', '#trending'],
        }}
      />,
    );

    const metadata = screen.getByLabelText('Project metadata for Portfolio Builder');
    const tags = screen.getByLabelText('Tags for Portfolio Builder');
    expect(within(metadata).getByText('C++/AI')).toBeInTheDocument();
    expect(within(metadata).getByText('Lead & Architect')).toBeInTheDocument();
    expect(within(tags).getByText('R&D')).toBeInTheDocument();
    expect(within(tags).getByText('#trending')).toBeInTheDocument();
  });

  it('renders only the metadata fields present when project type and tags are missing', () => {
    render(
      <ProjectHighlightCard
        project={{
          ...publishedProject,
          projectType: '',
          tags: [],
          role: 'Full-stack developer',
        }}
      />,
    );

    const metadata = screen.getByLabelText('Project metadata for Portfolio Builder');
    expect(within(metadata).getByText('Full-stack developer')).toBeInTheDocument();
    expect(within(metadata).queryByText('/')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tags for Portfolio Builder')).not.toBeInTheDocument();
  });

  it('renders only tags when project type and role are missing', () => {
    render(
      <ProjectHighlightCard
        project={{
          ...publishedProject,
          projectType: '',
          role: '',
          tags: ['portfolio'],
        }}
      />,
    );

    expect(screen.queryByText('/')).not.toBeInTheDocument();
    const tags = screen.getByLabelText('Tags for Portfolio Builder');
    expect(within(tags).getByText('portfolio')).toBeInTheDocument();
  });

  it('keeps the call to action visible after the cover image fails to load on a published project', async () => {
    render(<ProjectHighlightCard project={publishedProject} />);

    fireEvent.error(screen.getByRole('img', { name: 'Portfolio Builder cover image' }));

    expect(await screen.findByRole('img', { name: 'Placeholder image for Portfolio Builder' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View full project: Portfolio Builder' })).toHaveAttribute(
      'href',
      '/project/portfolio-builder',
    );
  });

  it('hides the call to action when the published project has no slug', () => {
    render(<ProjectHighlightCard project={{ ...publishedProject, slug: '' }} />);

    expect(screen.queryByRole('link', { name: /View full project/i })).not.toBeInTheDocument();
  });

  it('hides the call to action when the published project has a whitespace-only slug', () => {
    render(<ProjectHighlightCard project={{ ...publishedProject, slug: '   ' }} />);

    expect(screen.queryByRole('link', { name: /View full project/i })).not.toBeInTheDocument();
  });

  it.each(['DRAFT', 'UNPUBLISHED', 'PRIVATE'])(
    'hides the call to action for a %s visibility project even with a cover image and metadata',
    (visibility) => {
      render(<ProjectHighlightCard project={{ ...publishedProject, visibility }} />);

      expect(screen.getByRole('img', { name: 'Portfolio Builder cover image' })).toBeInTheDocument();
      expect(screen.getByLabelText('Project metadata for Portfolio Builder')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /View full project/i })).not.toBeInTheDocument();
    },
  );
});
