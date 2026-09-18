import { render, screen, waitFor } from '@testing-library/react';
import PublicProjectPage from './page';

let routeParams = { slug: 'portfolio-builder' };

jest.mock('next/navigation', () => ({
  useParams: () => routeParams,
  useRouter: () => ({ back: jest.fn() }),
}));

const projectResponse = {
  id: 'project-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A project documentation workspace.',
  projectType: 'OutSystems',
  role: 'Lead Developer',
  status: 'Completed',
  tags: ['portfolio', 'documentation'],
  coverImageUrl: 'https://example.com/cover.png',
  problem: 'Platform exports did not show the finished product.',
  features: 'Case study pages, project notes, and public sharing.',
  technicalNotes: 'Next.js, Prisma, and Supabase.',
  contribution: 'Designed and built the project workflow.',
  outcome: 'A reusable portfolio entry for external viewers.',
  visibility: 'published',
  publishedAt: '2026-09-15T21:00:00.000Z',
  owner: {
    username: 'ada',
    name: 'Ada Lovelace',
  },
};

describe('PublicProjectPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    routeParams = { slug: 'portfolio-builder' };
  });

  it('fetches and displays a published project case study', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => projectResponse,
    } as Response);

    render(<PublicProjectPage />);

    expect(screen.getByText('Loading project...')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/public/project/portfolio-builder'));
    expect(await screen.findByRole('heading', { name: 'Portfolio Builder' })).toBeInTheDocument();
    expect(screen.getByText('A project documentation workspace.')).toBeInTheDocument();
    expect(screen.getByText('OutSystems')).toBeInTheDocument();
    expect(screen.getByText('Lead Developer')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('portfolio')).toBeInTheDocument();
    expect(screen.getByText('documentation')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Portfolio Builder cover image' })).toHaveAttribute(
      'src',
      'https://example.com/cover.png',
    );
    expect(screen.getByText('Platform exports did not show the finished product.')).toBeInTheDocument();
    expect(screen.getByText('Case study pages, project notes, and public sharing.')).toBeInTheDocument();
    expect(screen.getByText('Next.js, Prisma, and Supabase.')).toBeInTheDocument();
    expect(screen.getByText('Designed and built the project workflow.')).toBeInTheDocument();
    expect(screen.getByText('A reusable portfolio entry for external viewers.')).toBeInTheDocument();
  });

  it('shows an access denied message for unpublished or private projects', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'project_not_public' }),
    } as Response);

    render(<PublicProjectPage />);

    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.getByText('This project is unpublished or private.')).toBeInTheDocument();
  });

  it('shows a not found message for missing projects', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'project_not_found' }),
    } as Response);

    render(<PublicProjectPage />);

    expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument();
    expect(screen.getByText('This project does not exist or is unavailable.')).toBeInTheDocument();
  });

  it('shows a generic error message for unexpected failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'unexpected_failure' }),
    } as Response);

    render(<PublicProjectPage />);

    expect(await screen.findByRole('heading', { name: 'Project unavailable' })).toBeInTheDocument();
    expect(screen.getByText('The project could not be loaded.')).toBeInTheDocument();
  });
});
