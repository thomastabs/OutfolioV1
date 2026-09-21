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
  publishedAt: '2026-09-15T21:00:00.000Z',
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
    expect(screen.getByText('Published at')).toBeInTheDocument();
    expect(screen.getByText('2026-09-15T21:00:00.000Z')).toBeInTheDocument();
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

  it('publishes a draft project and reflects the updated visibility', async () => {
    const user = userEvent.setup();
    const onProjectUpdated = jest.fn();
    const publishedProject = {
      ...editableProject,
      visibility: 'published',
      publishedAt: '2026-09-15T21:00:00.000Z',
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => publishedProject,
    } as Response);

    render(<ProjectEditor project={editableProject} onProjectUpdated={onProjectUpdated} />);

    await user.click(screen.getByRole('button', { name: /publish project/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1/publish', {
        method: 'POST',
      }),
    );
    expect(onProjectUpdated).toHaveBeenCalledWith(publishedProject);
    expect(await screen.findByText('Project published.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^visibility$/i)).toHaveValue('published');
  });

  it('unpublishes a published project and reflects the updated visibility', async () => {
    const user = userEvent.setup();
    const onProjectUpdated = jest.fn();
    const publishedProject = {
      ...editableProject,
      visibility: 'published',
      publishedAt: '2026-09-15T21:00:00.000Z',
    };
    const unpublishedProject = {
      ...publishedProject,
      visibility: 'unpublished',
      publishedAt: null,
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => unpublishedProject,
    } as Response);

    render(<ProjectEditor project={publishedProject} onProjectUpdated={onProjectUpdated} />);

    await user.click(screen.getByRole('button', { name: /unpublish project/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1/unpublish', {
        method: 'POST',
      }),
    );
    expect(onProjectUpdated).toHaveBeenCalledWith(unpublishedProject);
    expect(await screen.findByText('Project unpublished.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^visibility$/i)).toHaveValue('unpublished');
  });

  it('shows publish validation errors returned by the backend', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'validation_failed',
        fields: {
          summary: 'Summary is required before publishing.',
        },
      }),
    } as Response);

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /publish project/i }));

    expect(await screen.findByText('Summary is required before publishing.')).toBeInTheDocument();
  });

  it('uploads and displays a valid .oml attachment with extracted metadata', async () => {
    const user = userEvent.setup();
    const attachment = {
      id: 'attachment-1',
      filename: 'orders-portal.oml',
      url: '/api/v1/projects/project-1/attachments/attachment-1/download',
      fileSize: 128,
      isOmlFile: true,
      metadata: { moduleName: 'OrdersPortal', version: '1.2.3' },
    };
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/attachments' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [attachment] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(
      screen.getByLabelText(/attachment files/i),
      new File(['<moduleName>OrdersPortal</moduleName><version>1.2.3</version>'], 'orders-portal.oml', {
        type: 'application/octet-stream',
      }),
    );
    await user.click(screen.getByRole('button', { name: /upload attachments/i }));

    expect(await screen.findByText('Project attachments were uploaded and .oml metadata was validated.')).toBeInTheDocument();
    expect(screen.getByText('orders-portal.oml')).toBeInTheDocument();
    expect(screen.getByText('OrdersPortal')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
  });

  it('uploads and displays multiple supported project attachments', async () => {
    const user = userEvent.setup();
    const attachments = [
      {
        id: 'attachment-1',
        filename: 'orders-portal.oml',
        url: '/api/v1/projects/project-1/attachments/attachment-1/download',
        fileSize: 128,
        isOmlFile: true,
        fileType: 'application/octet-stream',
        metadata: { moduleName: 'OrdersPortal', version: '1.2.3' },
      },
      {
        id: 'attachment-2',
        filename: 'architecture.pdf',
        url: '/api/v1/projects/project-1/attachments/attachment-2/download',
        fileSize: 512,
        isOmlFile: false,
        fileType: 'application/pdf',
        metadata: null,
      },
    ];
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/attachments' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/attachment files/i), [
      new File(['<moduleName>OrdersPortal</moduleName><version>1.2.3</version>'], 'orders-portal.oml', {
        type: 'application/octet-stream',
      }),
      new File(['%PDF-1.4'], 'architecture.pdf', { type: 'application/pdf' }),
    ]);
    await user.click(screen.getByRole('button', { name: /upload attachments/i }));

    expect(await screen.findByText('Project attachments were uploaded and .oml metadata was validated.')).toBeInTheDocument();
    expect(screen.getByText('orders-portal.oml')).toBeInTheDocument();
    expect(screen.getByText('architecture.pdf')).toBeInTheDocument();
    expect(screen.getByText('OrdersPortal')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getByText('No extracted metadata')).toBeInTheDocument();
  });

  it('shows accessible feedback when an .oml upload is rejected', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/attachments' && init?.method === 'POST') {
        return {
          ok: false,
          status: 422,
          json: async () => ({
            error: 'invalid_oml_file',
            message: 'The uploaded .oml file is invalid or corrupted. Please upload a valid file.',
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/attachment files/i), new File(['corrupted invalid_oml'], 'broken.oml'));
    await user.click(screen.getByRole('button', { name: /upload attachments/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The uploaded .oml file is invalid or corrupted. Please upload a valid file.',
    );
  });

  it('lists, deletes, and reorders .oml attachments in edit mode', async () => {
    const user = userEvent.setup();
    const firstAttachment = {
      id: 'attachment-1',
      filename: 'orders-portal.oml',
      url: '/download/1',
      fileSize: 128,
      isOmlFile: true,
      metadata: { moduleName: 'OrdersPortal', version: '1.2.3' },
    };
    const secondAttachment = {
      id: 'attachment-2',
      filename: 'crm-app.oml',
      url: '/download/2',
      fileSize: 256,
      isOmlFile: true,
      metadata: { moduleName: 'CRMApp', version: '2.0.0' },
    };
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [firstAttachment, secondAttachment] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/attachments/order' && init?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [secondAttachment, firstAttachment] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/attachments/attachment-1' && init?.method === 'DELETE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    expect(await screen.findByText('orders-portal.oml')).toBeInTheDocument();
    expect(screen.getByText('crm-app.oml')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /move crm-app\.oml up/i }));
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1/attachments/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: ['attachment-2', 'attachment-1'] }),
    });

    await user.click(screen.getByRole('button', { name: /delete orders-portal\.oml/i }));
    expect(await screen.findByText('The project attachment was deleted.')).toBeInTheDocument();
    expect(screen.queryByText('orders-portal.oml')).not.toBeInTheDocument();
  });

  it('uploads multiple valid images and displays them in the project gallery', async () => {
    const user = userEvent.setup();
    const images = [
      { id: 'image-1', url: 'data:image/png;base64,ZmFrZQ==', order: 0 },
      { id: 'image-2', url: 'data:image/jpeg;base64,ZmFrZQ==', order: 1 },
    ];
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        return {
          ok: true,
          status: 200,
          json: async () => ({ images }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/image files/i), [
      new File(['image-one'], 'screen.png', { type: 'image/png' }),
      new File(['image-two'], 'flow.jpg', { type: 'image/jpeg' }),
    ]);
    await user.click(screen.getByRole('button', { name: /upload images/i }));

    expect(await screen.findByText('Project images uploaded.')).toBeInTheDocument();
    expect(screen.getByAltText('Project gallery image 1')).toBeInTheDocument();
    expect(screen.getByAltText('Project gallery image 2')).toBeInTheDocument();
  });

  it('prevents unsupported image types before upload', async () => {
    const user = userEvent.setup({ applyAccept: false });
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/projects/project-1/attachments') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/image files/i), new File(['not-image'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only JPEG, PNG, GIF, or WebP images can be uploaded.');
    expect(screen.getByRole('button', { name: /upload images/i })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/v1/projects/project-1/images', expect.objectContaining({ method: 'POST' }));
  });

  it('prevents unsupported attachment types before upload', async () => {
    const user = userEvent.setup({ applyAccept: false });
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/projects/project-1/attachments') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/attachment files/i), new File(['binary'], 'malware.exe', {
      type: 'application/x-msdownload',
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only .oml, PDF, text, Markdown, or ZIP attachments can be uploaded.');
    expect(screen.getByRole('button', { name: /upload attachments/i })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/v1/projects/project-1/attachments', expect.objectContaining({ method: 'POST' }));
  });

  it('prevents supported attachment extensions with unsupported MIME types before upload', async () => {
    const user = userEvent.setup({ applyAccept: false });
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/projects/project-1/attachments') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/attachment files/i), new File(['not a pdf'], 'architecture.pdf', {
      type: 'text/plain',
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only .oml, PDF, text, Markdown, or ZIP attachments can be uploaded.');
    expect(screen.getByRole('button', { name: /upload attachments/i })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/v1/projects/project-1/attachments', expect.objectContaining({ method: 'POST' }));
  });

  it('prevents oversized attachments before upload', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/projects/project-1/attachments') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });
    const oversizedAttachment = new File(['small body'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedAttachment, 'size', { value: 50 * 1024 * 1024 + 1 });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/attachment files/i), oversizedAttachment);

    expect(await screen.findByRole('alert')).toHaveTextContent('Attachments must be 50 MiB or smaller.');
    expect(screen.getByRole('button', { name: /upload attachments/i })).toBeDisabled();
  });

  it('prevents oversized images before upload', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/projects/project-1/attachments') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });
    const oversizedImage = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    await user.upload(screen.getByLabelText(/image files/i), oversizedImage);

    expect(await screen.findByRole('alert')).toHaveTextContent('Images must be 10 MiB or smaller.');
    expect(screen.getByRole('button', { name: /upload images/i })).toBeDisabled();
  });

  it('deletes and reorders project gallery images', async () => {
    const user = userEvent.setup();
    const firstImage = { id: 'image-1', url: 'data:image/png;base64,ZmFrZQ==', order: 0 };
    const secondImage = { id: 'image-2', url: 'data:image/jpeg;base64,ZmFrZQ==', order: 1 };
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [firstImage, secondImage] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images/order' && init?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [secondImage, firstImage] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images/image-1' && init?.method === 'DELETE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    expect(await screen.findByAltText('Project gallery image 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move image 1 up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move image 2 down/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /move image 2 up/i }));
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1/images/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: ['image-2', 'image-1'] }),
    });

    await user.click(screen.getByRole('button', { name: /delete image 2/i }));
    expect(await screen.findByText('Project image deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete image 2/i })).not.toBeInTheDocument();
  });

  it('shows an error when deleting a missing project gallery image fails', async () => {
    const user = userEvent.setup();
    const image = { id: 'image-1', url: 'data:image/png;base64,ZmFrZQ==', order: 0 };
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ attachments: [] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images' && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ images: [image] }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1/images/image-1' && init?.method === 'DELETE') {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'image_not_found' }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    render(<ProjectEditor project={editableProject} onProjectUpdated={jest.fn()} />);

    expect(await screen.findByAltText('Project gallery image 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /delete image 1/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the project image.');
    expect(screen.getByAltText('Project gallery image 1')).toBeInTheDocument();
  });
});
