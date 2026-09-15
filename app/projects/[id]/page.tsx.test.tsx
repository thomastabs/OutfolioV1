import { render, screen, waitFor } from '@testing-library/react';
import ProjectEditPage from './page';

const replace = jest.fn();
let sessionState: { status: 'loading' | 'authenticated' | 'unauthenticated'; data?: unknown } = {
  status: 'authenticated',
  data: { user: { email: 'ada@example.com' } },
};

jest.mock('next-auth/react', () => ({
  useSession: () => sessionState,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

const project = {
  id: 'project-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A project documentation workspace.',
  projectType: 'OutSystems',
  role: 'Developer',
  status: 'draft',
  tags: ['portfolio'],
  coverImageUrl: '',
  problem: 'Exports lose the visual layer.',
  features: 'Case study authoring.',
  technicalNotes: 'Existing technical notes.',
  contribution: 'Built the workflow.',
  outcome: 'Reusable portfolio entry.',
  visibility: 'draft',
  publishedAt: null,
  createdAt: '2026-09-15T18:00:00.000Z',
  updatedAt: '2026-09-15T18:30:00.000Z',
};

describe('ProjectEditPage', () => {
  beforeEach(() => {
    replace.mockClear();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    sessionState = {
      status: 'authenticated',
      data: { user: { email: 'ada@example.com' } },
    };
  });

  it('shows a loading state while fetching project data', () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => undefined));

    render(<ProjectEditPage params={{ id: 'project-1' }} />);

    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('loads an owned project and renders the editor', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => project,
    } as Response);

    render(<ProjectEditPage params={{ id: 'project-1' }} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1'));
    expect(await screen.findByDisplayValue('Portfolio Builder')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing technical notes.')).toBeInTheDocument();
  });

  it('shows an unavailable message for unauthorized or missing projects', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'project_not_found' }),
    } as Response);

    render(<ProjectEditPage params={{ id: 'missing-project' }} />);

    expect(await screen.findByText('Project is unavailable.')).toBeInTheDocument();
  });

  it('shows a generic message for unexpected project load errors', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));

    render(<ProjectEditPage params={{ id: 'project-1' }} />);

    expect(await screen.findByText('Project could not be loaded.')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    sessionState = { status: 'unauthenticated', data: null };

    render(<ProjectEditPage params={{ id: 'project-1' }} />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
