import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectEditor } from './ProjectEditor';

const createdProject = {
  id: 'project-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A project documentation workspace.',
  role: 'Developer',
  status: 'draft',
  visibility: 'draft',
  publishedAt: null,
  createdAt: '2026-09-15T18:00:00.000Z',
  updatedAt: '2026-09-15T18:00:00.000Z',
};

describe('ProjectEditor', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('prevents submission and shows validation errors when required fields are missing', async () => {
    const user = userEvent.setup();

    render(<ProjectEditor onProjectCreated={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Summary is required.')).toBeInTheDocument();
    expect(screen.getByText('Role is required.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits valid project data and notifies the parent on success', async () => {
    const user = userEvent.setup();
    const onProjectCreated = jest.fn();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => createdProject,
    } as Response);

    render(<ProjectEditor onProjectCreated={onProjectCreated} />);

    await user.type(screen.getByLabelText(/^title$/i), 'Portfolio Builder');
    await user.type(screen.getByLabelText(/^summary$/i), 'A project documentation workspace.');
    await user.type(screen.getByLabelText(/^role$/i), 'Developer');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"title":"Portfolio Builder"'),
      }),
    );
    expect(onProjectCreated).toHaveBeenCalledWith(createdProject);
    expect(await screen.findByText('Project draft created.')).toBeInTheDocument();
  });

  it('shows duplicate slug errors from the API', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'duplicate_slug',
        message: 'A project with this slug already exists. Choose a unique title.',
      }),
    } as Response);

    render(<ProjectEditor onProjectCreated={jest.fn()} />);

    await user.type(screen.getByLabelText(/^title$/i), 'Portfolio Builder');
    await user.type(screen.getByLabelText(/^summary$/i), 'A project documentation workspace.');
    await user.type(screen.getByLabelText(/^role$/i), 'Developer');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText('Choose a unique title or slug before saving.')).toBeInTheDocument();
  });
});
