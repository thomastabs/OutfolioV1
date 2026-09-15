import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsPage from './page';

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

describe('ProjectsPage session guard', () => {
  beforeEach(() => {
    replace.mockClear();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    sessionState = {
      status: 'authenticated',
      data: { user: { email: 'ada@example.com' } },
    };
  });

  it('shows the project management workspace for authenticated users', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ projects: [] }),
    } as Response);

    render(<ProjectsPage />);

    expect(screen.getByText('Project management workspace')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('fetches and displays existing draft projects', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        projects: [
          {
            id: 'project-1',
            title: 'Portfolio Builder',
            slug: 'portfolio-builder',
            summary: 'A project documentation workspace.',
            role: 'Developer',
            status: 'draft',
            visibility: 'draft',
          },
        ],
      }),
    } as Response);

    render(<ProjectsPage />);

    const projectList = await screen.findByRole('region', { name: /project list/i });
    expect(within(projectList).getByText('Portfolio Builder')).toBeInTheDocument();
    expect(within(projectList).getByText('Draft')).toBeInTheDocument();
  });

  it('adds a newly created draft project to the list', async () => {
    const user = userEvent.setup();
    const createdProject = {
      id: 'project-2',
      title: 'New Case Study',
      slug: 'new-case-study',
      summary: 'A new project draft.',
      role: 'Developer',
      status: 'draft',
      visibility: 'draft',
    };
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createdProject,
      } as Response);

    render(<ProjectsPage />);

    await user.type(screen.getByLabelText(/^title$/i), 'New Case Study');
    await user.type(screen.getByLabelText(/^summary$/i), 'A new project draft.');
    await user.type(screen.getByLabelText(/^role$/i), 'Developer');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    const projectList = await screen.findByRole('region', { name: /project list/i });
    expect(within(projectList).getByText('New Case Study')).toBeInTheDocument();
    expect(within(projectList).getByText('Draft')).toBeInTheDocument();
  });

  it('refreshes the project list after a project edit is saved', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: 'project-1',
              title: 'Portfolio Builder',
              slug: 'portfolio-builder',
              summary: 'Original summary.',
              role: 'Developer',
              status: 'draft',
              visibility: 'draft',
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'project-1',
          title: 'Portfolio Builder',
          slug: 'portfolio-builder',
          summary: 'Updated summary.',
          role: 'Developer',
          status: 'draft',
          visibility: 'draft',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: 'project-1',
              title: 'Portfolio Builder',
              slug: 'portfolio-builder',
              summary: 'Updated summary.',
              role: 'Developer',
              status: 'draft',
              visibility: 'draft',
            },
          ],
        }),
      } as Response);

    render(<ProjectsPage />);

    await screen.findByText('Original summary.');
    await user.click(screen.getByRole('button', { name: /edit portfolio builder/i }));
    await user.clear(screen.getByLabelText(/^summary$/i));
    await user.type(screen.getByLabelText(/^summary$/i), 'Updated summary.');
    await user.click(screen.getByRole('button', { name: /save project/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1', expect.objectContaining({ method: 'PUT' })));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects'));
    const projectList = await screen.findByRole('region', { name: /project list/i });
    expect(within(projectList).getByText('Updated summary.')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login without rendering the workspace', async () => {
    sessionState = { status: 'unauthenticated', data: null };

    render(<ProjectsPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Project management workspace')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a loading state while the session is being determined', () => {
    sessionState = { status: 'loading', data: null };

    render(<ProjectsPage />);

    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByText('Project management workspace')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
