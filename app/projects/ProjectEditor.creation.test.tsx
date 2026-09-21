import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectEditor } from './ProjectEditor';

const createdProject = {
  id: 'project-1',
  title: 'Creation Media Project',
  slug: 'creation-media-project',
  summary: 'Created with project media.',
  role: 'Developer',
  status: 'draft',
  visibility: 'draft',
  publishedAt: null,
  createdAt: '2026-09-21T21:30:00.000Z',
  updatedAt: '2026-09-21T21:30:00.000Z',
};

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe('Story 9563893: ProjectEditor media upload during project creation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('renders cover image, gallery image, and attachment controls in create mode', () => {
    render(<ProjectEditor onProjectCreated={jest.fn()} />);

    expect(screen.getByLabelText(/upload cover image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/image files/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/attachment files/i)).toBeInTheDocument();
    expect(screen.getAllByText('Included on create')).toHaveLength(2);
  });

  it('creates a project, uploads gallery images and attachments, and returns media with the created project', async () => {
    const user = userEvent.setup();
    const onProjectCreated = jest.fn();
    const uploadedImages = [
      { id: 'image-1', url: 'data:image/png;base64,c2NyZWVu', order: 0 },
    ];
    const uploadedAttachments = [
      {
        id: 'attachment-1',
        filename: 'orders.oml',
        url: '/api/v1/projects/project-1/attachments/attachment-1/download',
        fileType: 'application/octet-stream',
        fileSize: 64,
        isOmlFile: true,
        order: 0,
        metadata: { moduleName: 'Orders', version: '1.0.0' },
      },
    ];

    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects' && init?.method === 'POST') {
        // A selected cover image file is uploaded to Supabase Storage via
        // a multipart body (Story 9564046), not base64-encoded into a
        // JSON coverImageUrl field.
        expect(init.body).toBeInstanceOf(FormData);
        expect((init.body as FormData).get('coverImage')).toBeInstanceOf(File);
        return okResponse({
          ...createdProject,
          coverImageUrl: 'https://signed.example/projects/project-1/cover/cover-1.png',
        });
      }

      if (url === '/api/v1/projects/project-1/images' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        return okResponse({ images: uploadedImages });
      }

      if (url === '/api/v1/projects/project-1/attachments' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData);
        return okResponse({ attachments: uploadedAttachments });
      }

      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(<ProjectEditor onProjectCreated={onProjectCreated} />);

    await user.type(screen.getByLabelText(/^title$/i), 'Creation Media Project');
    await user.type(screen.getByLabelText(/^summary$/i), 'Created with project media.');
    await user.type(screen.getByLabelText(/^role$/i), 'Developer');
    await user.upload(
      screen.getByLabelText(/upload cover image/i),
      new File(['cover'], 'cover.png', { type: 'image/png' }),
    );
    await user.upload(
      screen.getByLabelText(/image files/i),
      new File(['screen'], 'screen.png', { type: 'image/png' }),
    );
    await user.upload(
      screen.getByLabelText(/attachment files/i),
      new File(['<moduleName>Orders</moduleName><version>1.0.0</version>'], 'orders.oml', {
        type: 'application/octet-stream',
      }),
    );

    expect(await screen.findByText(/cover\.png will be uploaded/i)).toBeInTheDocument();
    expect(screen.getByText(/selected 1 image/i)).toBeInTheDocument();
    expect(screen.getByText(/orders\.oml/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects', expect.objectContaining({
      method: 'POST',
    })));
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1/images', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }));
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1/attachments', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }));
    expect(onProjectCreated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-1',
      coverImageUrl: 'https://signed.example/projects/project-1/cover/cover-1.png',
      images: uploadedImages,
      attachments: uploadedAttachments,
    }));
    expect(await screen.findByText('Project draft created with media.')).toBeInTheDocument();
  });

  it('rolls back the created draft when create-time media upload fails', async () => {
    const user = userEvent.setup();
    const onProjectCreated = jest.fn();

    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects' && init?.method === 'POST') {
        return okResponse({
          ...createdProject,
          coverImageUrl: 'https://signed.example/projects/project-1/cover/cover-1.png',
        });
      }

      if (url === '/api/v1/projects/project-1/images' && init?.method === 'POST') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'Image upload failed.' }),
        } as Response;
      }

      if (url === '/api/v1/projects/project-1' && init?.method === 'DELETE') {
        return okResponse({ success: true });
      }

      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(<ProjectEditor onProjectCreated={onProjectCreated} />);

    await user.type(screen.getByLabelText(/^title$/i), 'Creation Media Project');
    await user.type(screen.getByLabelText(/^summary$/i), 'Created with project media.');
    await user.type(screen.getByLabelText(/^role$/i), 'Developer');
    await user.upload(
      screen.getByLabelText(/upload cover image/i),
      new File(['cover'], 'cover.png', { type: 'image/png' }),
    );
    await user.upload(
      screen.getByLabelText(/image files/i),
      new File(['screen'], 'screen.png', { type: 'image/png' }),
    );

    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/project-1', expect.objectContaining({
      method: 'DELETE',
    })));
    expect(onProjectCreated).not.toHaveBeenCalled();
    expect(await screen.findByText('Project media upload failed, so the new draft was rolled back.')).toBeInTheDocument();
  });

  it('prevents invalid create-mode media selections before submission', async () => {
    const user = userEvent.setup({ applyAccept: false });

    render(<ProjectEditor onProjectCreated={jest.fn()} />);

    await user.upload(
      screen.getByLabelText(/upload cover image/i),
      new File(['not-image'], 'cover.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Only JPEG, PNG, GIF, or WebP images can be uploaded.');
    expect(screen.getByRole('button', { name: /create project/i })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uploads a replacement cover image via multipart PUT in edit mode, not a base64 JSON body', async () => {
    const user = userEvent.setup();
    const onProjectUpdated = jest.fn();

    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/v1/projects/project-1/attachments') {
        return okResponse({ attachments: [] });
      }
      if (url === '/api/v1/projects/project-1/images') {
        return okResponse({ images: [] });
      }
      if (url === '/api/v1/projects/project-1' && init?.method === 'PUT') {
        expect(init.body).toBeInstanceOf(FormData);
        expect((init.body as FormData).get('coverImage')).toBeInstanceOf(File);
        // The plain-text coverImageUrl field must not be sent alongside a
        // replacement file - the backend uses the uploaded file instead.
        expect((init.body as FormData).get('coverImageUrl')).toBeNull();
        return okResponse({
          ...createdProject,
          coverImageUrl: 'https://signed.example/projects/project-1/cover/new-cover.png',
        });
      }
      return okResponse({});
    });

    render(<ProjectEditor project={createdProject} onProjectUpdated={onProjectUpdated} />);

    await user.upload(
      screen.getByLabelText(/upload cover image/i),
      new File(['new-cover'], 'new-cover.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: /save project/i }));

    await waitFor(() => expect(onProjectUpdated).toHaveBeenCalledWith(expect.objectContaining({
      coverImageUrl: 'https://signed.example/projects/project-1/cover/new-cover.png',
    })));
  });

  it('keeps edit-mode upload buttons available for existing projects', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/projects/project-1/attachments') {
        return okResponse({ attachments: [] });
      }
      if (url === '/api/v1/projects/project-1/images') {
        return okResponse({ images: [] });
      }
      return okResponse({});
    });

    render(<ProjectEditor project={createdProject} onProjectUpdated={jest.fn()} />);

    const imageSection = screen.getByRole('heading', { name: /project image gallery/i }).closest('section');
    const attachmentSection = screen.getByRole('heading', { name: /project attachments/i }).closest('section');

    expect(await within(imageSection as HTMLElement).findByRole('button', { name: /upload images/i })).toBeDisabled();
    expect(await within(attachmentSection as HTMLElement).findByRole('button', { name: /upload attachments/i })).toBeDisabled();
  });
});
