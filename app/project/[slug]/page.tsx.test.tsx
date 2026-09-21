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

const imageResponse = {
  images: [
    { id: 'image-2', url: 'data:image/jpeg;base64,two', order: 0 },
    { id: 'image-1', url: 'data:image/png;base64,one', order: 1 },
  ],
};

describe('PublicProjectPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    routeParams = { slug: 'portfolio-builder' };
  });

  it('fetches and displays a published project case study', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/public/project/portfolio-builder/images') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => projectResponse,
      } as Response;
    });

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
    expect(await screen.findByText('No project images are available yet.')).toBeInTheDocument();
  });

  it('fetches and displays the ordered public project image gallery', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/public/project/portfolio-builder/images') {
        return {
          ok: true,
          status: 200,
          json: async () => imageResponse,
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => projectResponse,
      } as Response;
    });

    render(<PublicProjectPage />);

    expect(await screen.findByRole('heading', { name: 'Portfolio Builder' })).toBeInTheDocument();
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/public/project/portfolio-builder/images'),
    );
    const galleryImages = await screen.findAllByRole('img', { name: /portfolio builder gallery image/i });
    expect(galleryImages).toHaveLength(2);
    expect(galleryImages[0]).toHaveAttribute('src', 'data:image/jpeg;base64,two');
    expect(galleryImages[1]).toHaveAttribute('src', 'data:image/png;base64,one');
  });

  it('renders a large number of gallery images without truncating', async () => {
    const manyImages = {
      images: Array.from({ length: 20 }, (_, index) => ({
        id: `image-${index}`,
        url: `data:image/png;base64,img${index}`,
        order: index,
      })),
    };
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/public/project/portfolio-builder/images') {
        return { ok: true, status: 200, json: async () => manyImages } as Response;
      }

      return { ok: true, status: 200, json: async () => projectResponse } as Response;
    });

    render(<PublicProjectPage />);

    const galleryImages = await screen.findAllByRole('img', { name: /portfolio builder gallery image/i });
    expect(galleryImages).toHaveLength(20);
  });

  it('renders gallery images with duplicate order values without crashing', async () => {
    const duplicateOrderImages = {
      images: [
        { id: 'image-1', url: 'data:image/png;base64,one', order: 0 },
        { id: 'image-2', url: 'data:image/png;base64,two', order: 0 },
      ],
    };
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/public/project/portfolio-builder/images') {
        return { ok: true, status: 200, json: async () => duplicateOrderImages } as Response;
      }

      return { ok: true, status: 200, json: async () => projectResponse } as Response;
    });

    render(<PublicProjectPage />);

    const galleryImages = await screen.findAllByRole('img', { name: /portfolio builder gallery image/i });
    expect(galleryImages).toHaveLength(2);
  });

  it('renders without crashing when a gallery image has an empty url', async () => {
    const emptyUrlImages = {
      images: [{ id: 'image-1', url: '', order: 0 }],
    };
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/public/project/portfolio-builder/images') {
        return { ok: true, status: 200, json: async () => emptyUrlImages } as Response;
      }

      return { ok: true, status: 200, json: async () => projectResponse } as Response;
    });

    render(<PublicProjectPage />);

    expect(await screen.findByRole('img', { name: 'Portfolio Builder gallery image 1' })).toHaveAttribute('src', '');
  });

  it('renders gallery images with special characters in the project title alt text safely', async () => {
    const specialTitleProject = { ...projectResponse, title: 'R&D <Beta> "Launch"' };
    const oneImage = { images: [{ id: 'image-1', url: 'data:image/png;base64,one', order: 0 }] };
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/public/project/portfolio-builder/images') {
        return { ok: true, status: 200, json: async () => oneImage } as Response;
      }

      return { ok: true, status: 200, json: async () => specialTitleProject } as Response;
    });

    render(<PublicProjectPage />);

    expect(
      await screen.findByRole('img', { name: 'R&D <Beta> "Launch" gallery image 1' }),
    ).toBeInTheDocument();
  });

  it('shows a gallery error message when public project images cannot be loaded', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/public/project/portfolio-builder/images') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'unexpected_failure' }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => projectResponse,
      } as Response;
    });

    render(<PublicProjectPage />);

    expect(await screen.findByRole('heading', { name: 'Portfolio Builder' })).toBeInTheDocument();
    expect(await screen.findByText('Project images could not be loaded.')).toBeInTheDocument();
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
