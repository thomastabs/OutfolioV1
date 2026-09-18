import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  {
    id: 'project-2',
    title: 'Published Portfolio',
    slug: 'published-portfolio',
    summary: 'A published case study.',
    role: 'Developer',
    status: 'published',
    visibility: 'published',
  },
];

describe('ProjectList', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('shows a loading state', () => {
    render(<ProjectList projects={[]} status="loading" />);

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });

  it('shows an error state', () => {
    render(<ProjectList projects={[]} status="error" />);

    expect(screen.getByText('Projects could not be loaded.')).toBeInTheDocument();
  });

  it('displays draft projects distinctly', () => {
    render(<ProjectList projects={[projects[0]]} status="ready" />);

    expect(screen.getByText('Portfolio Builder')).toBeInTheDocument();
    expect(screen.getByText('A project documentation workspace.')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('uses branded visual indicators for project visibility states', () => {
    render(<ProjectList projects={projects} status="ready" />);

    expect(screen.getByText('Draft')).toHaveClass('state-indicator');
    expect(screen.getByText('Draft')).toHaveClass('state-indicator--draft');
    expect(screen.getByText('Published')).toHaveClass('state-indicator');
    expect(screen.getByText('Published')).toHaveClass('state-indicator--published');
  });

  it('shows delete controls only for draft projects', () => {
    render(<ProjectList projects={projects} status="ready" />);

    expect(screen.getByRole('button', { name: /delete portfolio builder/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete published portfolio/i })).not.toBeInTheDocument();
  });

  it('shows publish and unpublish controls based on visibility', () => {
    render(<ProjectList projects={projects} status="ready" onPublishProject={jest.fn()} onUnpublishProject={jest.fn()} />);

    expect(screen.getByRole('button', { name: /publish portfolio builder/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unpublish published portfolio/i })).toBeInTheDocument();
  });

  it('calls publish and unpublish callbacks from project controls', async () => {
    const user = userEvent.setup();
    const onPublishProject = jest.fn();
    const onUnpublishProject = jest.fn();

    render(
      <ProjectList
        projects={projects}
        status="ready"
        onPublishProject={onPublishProject}
        onUnpublishProject={onUnpublishProject}
      />,
    );

    await user.click(screen.getByRole('button', { name: /publish portfolio builder/i }));
    await user.click(screen.getByRole('button', { name: /unpublish published portfolio/i }));

    expect(onPublishProject).toHaveBeenCalledWith('project-1');
    expect(onUnpublishProject).toHaveBeenCalledWith('project-2');
  });

  it('opens a confirmation dialog before deleting a draft project', async () => {
    const user = userEvent.setup();

    render(<ProjectList projects={[projects[0]]} status="ready" />);

    await user.click(screen.getByRole('button', { name: /delete portfolio builder/i }));

    expect(screen.getByRole('dialog', { name: /delete portfolio builder/i })).toBeInTheDocument();
    expect(screen.getByText('This draft project will be permanently deleted.')).toBeInTheDocument();
  });

  it('confirms deletion, calls the API, and removes the project from the list', async () => {
    const user = userEvent.setup();
    const onProjectDeleted = jest.fn();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    render(<ProjectList projects={[projects[0]]} status="ready" onProjectDeleted={onProjectDeleted} />);

    await user.click(screen.getByRole('button', { name: /delete portfolio builder/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1', {
        method: 'DELETE',
      }),
    );
    await waitFor(() => expect(screen.queryByText('Portfolio Builder')).not.toBeInTheDocument());
    expect(onProjectDeleted).toHaveBeenCalledWith('project-1');
  });

  it('shows an error message when deletion is rejected', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'project_not_draft',
        message: 'Only draft projects can be deleted. Unpublish the project first.',
      }),
    } as Response);

    render(<ProjectList projects={[projects[0]]} status="ready" />);

    await user.click(screen.getByRole('button', { name: /delete portfolio builder/i }));
    const dialog = screen.getByRole('dialog', { name: /delete portfolio builder/i });
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    expect(await screen.findByText('Only draft projects can be deleted. Unpublish the project first.')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Builder')).toBeInTheDocument();
  });
});
