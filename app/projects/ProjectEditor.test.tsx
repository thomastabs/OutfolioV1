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

const editableProject = {
  ...createdProject,
  projectType: 'OutSystems',
  tags: ['portfolio'],
  coverImageUrl: '',
  problem: 'Exports lose the visual layer.',
  features: 'Case study authoring.',
  technicalNotes: 'Original notes.',
  contribution: 'Built the workflow.',
  outcome: 'Reusable portfolio entry.',
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

  it('renders existing project data when editing', () => {
    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    expect(screen.getByDisplayValue('Portfolio Builder')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A project documentation workspace.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original notes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save project/i })).toBeInTheDocument();
  });

  it('submits edited project data and notifies the parent on success', async () => {
    const user = userEvent.setup();
    const onProjectUpdated = jest.fn();
    const updatedProject = {
      ...editableProject,
      summary: 'Updated summary.',
      technicalNotes: 'Updated notes.',
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => updatedProject,
    } as Response);

    render(<ProjectEditor project={editableProject} onProjectUpdated={onProjectUpdated} />);

    await user.clear(screen.getByLabelText(/^summary$/i));
    await user.type(screen.getByLabelText(/^summary$/i), 'Updated summary.');
    await user.clear(screen.getByLabelText(/^technical notes$/i));
    await user.type(screen.getByLabelText(/^technical notes$/i), 'Updated notes.');
    await user.click(screen.getByRole('button', { name: /save project/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"technicalNotes":"Updated notes."'),
      }),
    );
    expect(onProjectUpdated).toHaveBeenCalledWith(updatedProject);
    expect(await screen.findByText('Project saved.')).toBeInTheDocument();
  });

  it('shows backend validation errors when editing', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'validation_failed',
        fields: {
          summary: 'Summary is required.',
          coverImageUrl: 'Cover image URL must be an HTTP or HTTPS URL.',
        },
      }),
    } as Response);

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /save project/i }));

    expect(await screen.findByText('Summary is required.')).toBeInTheDocument();
    expect(screen.getByText('Cover image URL must be an HTTP or HTTPS URL.')).toBeInTheDocument();
  });

  it('disables the save button while an edit request is in progress', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: async () => editableProject,
        } as Response), 20);
      }),
    );

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /save project/i }));

    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
  });
});
