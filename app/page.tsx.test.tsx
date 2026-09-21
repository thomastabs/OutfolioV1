import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';

const updateSharedSession = jest.fn().mockResolvedValue(undefined);

jest.mock('./session-context', () => ({
  useSession: () => ({ status: 'authenticated', data: null, update: updateSharedSession }),
}));

const dashboardResponse = {
  productName: 'Outfolio',
  valueProposition: 'Create a public developer portfolio with polished project case studies.',
  session: {
    authenticated: false,
  },
  publishedProjects: [
    {
      id: 'project-1',
      title: 'Portfolio Builder',
      slug: 'portfolio-builder',
      summary: 'A documentation workspace for portfolio projects.',
      coverImageUrl: 'https://example.com/portfolio-cover.png',
      projectType: 'Web app',
      tags: ['portfolio', 'documentation'],
      role: 'Full-stack developer',
      visibility: 'PUBLISHED',
    },
    {
      id: 'project-2',
      title: 'Case Study API',
      slug: 'case-study-api',
      summary: 'A public project API case study.',
      coverImageUrl: '',
      projectType: 'API',
      tags: ['api'],
      role: 'Backend developer',
      visibility: 'PUBLISHED',
    },
  ],
};

const authenticatedSessionResponse = {
  userId: 'user-1',
  username: 'ada',
  email: 'ada@example.com',
};

function mockHomeRequests(options: {
  dashboard?: typeof dashboardResponse;
  session?: typeof authenticatedSessionResponse;
  sessionStatus?: number;
  dashboardStatus?: number;
} = {}) {
  const dashboard = options.dashboard ?? dashboardResponse;
  const dashboardStatus = options.dashboardStatus ?? 200;
  const sessionStatus = options.sessionStatus ?? 401;
  const session = options.session ?? authenticatedSessionResponse;

  jest.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);

    if (url === '/api/v1/home/dashboard') {
      return Promise.resolve({
        ok: dashboardStatus >= 200 && dashboardStatus < 300,
        status: dashboardStatus,
        json: async () => (dashboardStatus >= 200 && dashboardStatus < 300 ? dashboard : { error: 'unexpected_failure' }),
      } as Response);
    }

    if (url === '/api/v1/auth/session') {
      return Promise.resolve({
        ok: sessionStatus >= 200 && sessionStatus < 300,
        status: sessionStatus,
        json: async () => (sessionStatus >= 200 && sessionStatus < 300 ? session : { error: 'missing_or_invalid_auth' }),
      } as Response);
    }

    if (url === '/api/v1/auth/logout') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

describe('HomePage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    updateSharedSession.mockClear();
  });

  it('loads dashboard data and displays product identity and visitor navigation', async () => {
    mockHomeRequests();

    const { container } = render(<HomePage />);

    expect(screen.getByText('Loading home dashboard...')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/home/dashboard'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/session'));
    expect(await screen.findByRole('heading', { name: 'Outfolio' })).toBeInTheDocument();
    expect(screen.getByText('Create a public developer portfolio with polished project case studies.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Discover projects' })).toHaveAttribute('href', '/discover');
    expect(container.querySelector('a[href="/profile"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/projects"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/404/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/missing page/i)).not.toBeInTheDocument();
  });

  it('renders working unauthenticated navigation links', async () => {
    const user = userEvent.setup();
    mockHomeRequests();

    render(<HomePage />);

    const registerLink = await screen.findByRole('link', { name: 'Register' });
    const loginLink = screen.getByRole('link', { name: 'Login' });
    const discoverLink = screen.getByRole('link', { name: 'Discover projects' });

    expect(registerLink).toHaveAttribute('href', '/register');
    expect(loginLink).toHaveAttribute('href', '/login');
    expect(discoverLink).toHaveAttribute('href', '/discover');

    [registerLink, loginLink, discoverLink].forEach((link) => {
      link.addEventListener('click', (event) => event.preventDefault());
    });

    await expect(user.click(registerLink)).resolves.toBeUndefined();
    await expect(user.click(loginLink)).resolves.toBeUndefined();
    await expect(user.click(discoverLink)).resolves.toBeUndefined();
  });

  it('displays published project highlights with titles and summaries', async () => {
    mockHomeRequests();

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    expect(within(list).getByText('Portfolio Builder')).toBeInTheDocument();
    expect(within(list).getByText('A documentation workspace for portfolio projects.')).toBeInTheDocument();
    expect(within(list).getByText('Case Study API')).toBeInTheDocument();
    expect(within(list).getByText('A public project API case study.')).toBeInTheDocument();
    expect(within(list).queryByText('Private Draft')).not.toBeInTheDocument();
    expect(within(list).queryByText('Unpublished Project')).not.toBeInTheDocument();
  });

  it('displays project cover images or accessible placeholders on highlight cards', async () => {
    mockHomeRequests();

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    const coverImage = within(list).getByRole('img', { name: 'Portfolio Builder cover image' });
    const placeholder = within(list).getByRole('img', { name: 'Placeholder image for Case Study API' });

    expect(coverImage).toHaveAttribute('src', 'https://example.com/portfolio-cover.png');
    expect(coverImage).toHaveClass('project-highlight-cover');
    expect(placeholder).toHaveClass('project-highlight-placeholder');
  });

  describe('Story 9560160: project highlight card layout', () => {
    it('renders the highlight list on the responsive grid layout hook', async () => {
      mockHomeRequests();

      render(<HomePage />);

      const list = await screen.findByRole('list', { name: 'Published project highlights' });
      expect(list).toHaveClass('project-highlight-grid');
    });

    it('combines cover image, metadata, and summary text within a single card for each highlight', async () => {
      mockHomeRequests();

      render(<HomePage />);

      const list = await screen.findByRole('list', { name: 'Published project highlights' });
      const cards = within(list).getAllByRole('listitem');
      expect(cards).toHaveLength(2);

      cards.forEach((card) => {
        expect(within(card).getByRole('heading')).toBeInTheDocument();
        expect(within(card).getByRole('img')).toBeInTheDocument();
        expect(card.querySelector('.project-highlight-card__copy')).not.toBeNull();
      });
    });

    it('renders long title, summary, and metadata text without breaking the card structure', async () => {
      const longTag = 'a'.repeat(80);
      mockHomeRequests({
        dashboard: {
          ...dashboardResponse,
          publishedProjects: [
            {
              ...dashboardResponse.publishedProjects[0],
              title: 'A'.repeat(120),
              summary: 'S'.repeat(600),
              projectType: 'T'.repeat(60),
              role: 'R'.repeat(60),
              tags: [longTag],
            },
            dashboardResponse.publishedProjects[1],
          ],
        },
      });

      render(<HomePage />);

      const list = await screen.findByRole('list', { name: 'Published project highlights' });
      expect(within(list).getByRole('heading', { name: 'A'.repeat(120) })).toBeInTheDocument();
      expect(within(list).getByText('S'.repeat(600))).toBeInTheDocument();
      expect(within(list).getByText(longTag)).toBeInTheDocument();
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });

    it('keeps the highlight grid layout unaffected by a mix of published and non-published projects', async () => {
      mockHomeRequests({
        dashboard: {
          ...dashboardResponse,
          publishedProjects: [
            dashboardResponse.publishedProjects[0],
            { ...dashboardResponse.publishedProjects[1], visibility: 'DRAFT' },
          ],
        },
      });

      render(<HomePage />);

      const list = await screen.findByRole('list', { name: 'Published project highlights' });
      expect(list).toHaveClass('project-highlight-grid');
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });
  });

  describe('Story 9560156: project highlight cover images', () => {
    it.each([
      { role: 'visitor', sessionStatus: 401 },
      { role: 'authenticated developer', sessionStatus: 200 },
    ])('SC-1 displays a visible cover image next to title and summary for a $role', async ({ sessionStatus }) => {
      mockHomeRequests({
        sessionStatus,
        session: authenticatedSessionResponse,
        dashboard: {
          ...dashboardResponse,
          publishedProjects: [dashboardResponse.publishedProjects[0]],
        },
      });

      render(<HomePage />);

      const list = await screen.findByRole('list', { name: 'Published project highlights' });
      const title = within(list).getByText('Portfolio Builder');
      const card = title.closest('li');
      expect(card).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/home/dashboard');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/session');

      const coverImage = within(card as HTMLElement).getByRole('img', { name: 'Portfolio Builder cover image' });
      expect(coverImage).toHaveAttribute('src', 'https://example.com/portfolio-cover.png');
      expect(coverImage).toHaveClass('project-highlight-cover');
      expect(within(card as HTMLElement).getByRole('heading', { name: 'Portfolio Builder' })).toBeInTheDocument();
      expect(within(card as HTMLElement).getByText('A documentation workspace for portfolio projects.')).toBeInTheDocument();
      expect(within(card as HTMLElement).queryByRole('img', { name: 'Placeholder image for Portfolio Builder' })).not.toBeInTheDocument();
    });

    it.each([
      { role: 'visitor', sessionStatus: 401 },
      { role: 'authenticated developer', sessionStatus: 200 },
    ])('SC-2 displays an accessible placeholder instead of blank space for a $role', async ({ sessionStatus }) => {
      mockHomeRequests({
        sessionStatus,
        session: authenticatedSessionResponse,
        dashboard: {
          ...dashboardResponse,
          publishedProjects: [
            {
              ...dashboardResponse.publishedProjects[1],
              coverImageUrl: '   ',
            },
          ],
        },
      });

      render(<HomePage />);

      const list = await screen.findByRole('list', { name: 'Published project highlights' });
      const title = within(list).getByText('Case Study API');
      const card = title.closest('li');
      expect(card).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/home/dashboard');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/session');

      const placeholder = within(card as HTMLElement).getByRole('img', { name: 'Placeholder image for Case Study API' });
      expect(placeholder).toHaveClass('project-highlight-placeholder');
      expect(within(card as HTMLElement).getByRole('heading', { name: 'Case Study API' })).toBeInTheDocument();
      expect(within(card as HTMLElement).getByText('A public project API case study.')).toBeInTheDocument();
      expect(within(card as HTMLElement).queryByRole('img', { name: 'Case Study API cover image' })).not.toBeInTheDocument();
    });
  });

  it('renders project highlight calls to action that link to public project pages', async () => {
    const user = userEvent.setup();
    mockHomeRequests();

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    const portfolioLink = within(list).getByRole('link', { name: 'View full project: Portfolio Builder' });
    const apiLink = within(list).getByRole('link', { name: 'View full project: Case Study API' });

    expect(portfolioLink).toHaveAttribute('href', '/project/portfolio-builder');
    expect(apiLink).toHaveAttribute('href', '/project/case-study-api');

    portfolioLink.addEventListener('click', (event) => event.preventDefault());
    await expect(user.click(portfolioLink)).resolves.toBeUndefined();
  });

  it('displays project metadata below published project highlight titles', async () => {
    mockHomeRequests();

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    const portfolioMetadata = within(list).getByLabelText('Project metadata for Portfolio Builder');
    const portfolioTags = within(list).getByLabelText('Tags for Portfolio Builder');

    expect(within(portfolioMetadata).getByText('Web app')).toBeInTheDocument();
    expect(within(portfolioMetadata).getByText('Full-stack developer')).toBeInTheDocument();
    expect(within(portfolioTags).getByText('portfolio')).toBeInTheDocument();
    expect(within(portfolioTags).getByText('documentation')).toBeInTheDocument();
  });

  it('omits empty project metadata fields without leaving placeholder text', async () => {
    mockHomeRequests({
      dashboard: {
        ...dashboardResponse,
        publishedProjects: [
          {
            ...dashboardResponse.publishedProjects[0],
            projectType: '',
            tags: [],
            role: '',
          },
        ],
      },
    });

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    expect(within(list).getByText('Portfolio Builder')).toBeInTheDocument();
    expect(within(list).queryByLabelText('Project metadata for Portfolio Builder')).not.toBeInTheDocument();
    expect(within(list).queryByLabelText('Tags for Portfolio Builder')).not.toBeInTheDocument();
    expect(within(list).queryByText(/No metadata/i)).not.toBeInTheDocument();
  });

  it('hides project highlight calls to action when a project is not publicly visible', async () => {
    mockHomeRequests({
      dashboard: {
        ...dashboardResponse,
        publishedProjects: [
          {
            ...dashboardResponse.publishedProjects[0],
            visibility: 'DRAFT',
          },
        ],
      },
    });

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    expect(within(list).getByText('Portfolio Builder')).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: /View full project/i })).not.toBeInTheDocument();
  });

  it('shows the call to action only on published cards within a mixed list', async () => {
    mockHomeRequests({
      dashboard: {
        ...dashboardResponse,
        publishedProjects: [
          dashboardResponse.publishedProjects[0],
          { ...dashboardResponse.publishedProjects[1], visibility: 'UNPUBLISHED' },
        ],
      },
    });

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    expect(within(list).getByRole('link', { name: 'View full project: Portfolio Builder' })).toBeInTheDocument();
    expect(
      within(list).queryByRole('link', { name: 'View full project: Case Study API' }),
    ).not.toBeInTheDocument();
  });

  it('falls back to a project highlight placeholder when a cover image fails to load', async () => {
    mockHomeRequests();

    render(<HomePage />);

    const list = await screen.findByRole('list', { name: 'Published project highlights' });
    const coverImage = within(list).getByRole('img', { name: 'Portfolio Builder cover image' });
    fireEvent.error(coverImage);

    expect(await within(list).findByRole('img', { name: 'Placeholder image for Portfolio Builder' })).toHaveClass(
      'project-highlight-placeholder',
    );
  });

  it('shows a friendly empty state when no published project highlights are available', async () => {
    mockHomeRequests({
      dashboard: {
        ...dashboardResponse,
        publishedProjects: [],
      },
    });

    render(<HomePage />);

    expect(await screen.findByText('No published projects are available yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register to add yours' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Explore discovery' })).toHaveAttribute('href', '/discover');
    expect(screen.queryByRole('list', { name: 'Published project highlights' })).not.toBeInTheDocument();
    expect(screen.queryByText('No summary available.')).not.toBeInTheDocument();
  });

  it('loads the current session and shows authenticated developer actions when authenticated', async () => {
    mockHomeRequests({
      sessionStatus: 200,
      session: authenticatedSessionResponse,
    });

    render(<HomePage />);

    expect(await screen.findByText('Welcome back, ada.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/session');
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'Manage projects' })).toHaveAttribute('href', '/projects');
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('renders working authenticated navigation links', async () => {
    const user = userEvent.setup();
    mockHomeRequests({
      sessionStatus: 200,
      session: authenticatedSessionResponse,
    });

    render(<HomePage />);

    const profileLink = await screen.findByRole('link', { name: 'Edit profile' });
    const projectsLink = screen.getByRole('link', { name: 'Manage projects' });

    expect(profileLink).toHaveAttribute('href', '/profile');
    expect(projectsLink).toHaveAttribute('href', '/projects');
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();

    [profileLink, projectsLink].forEach((link) => {
      link.addEventListener('click', (event) => event.preventDefault());
    });

    await expect(user.click(profileLink)).resolves.toBeUndefined();
    await expect(user.click(projectsLink)).resolves.toBeUndefined();
  });

  it('logs out an authenticated user and stays on the home dashboard as a visitor', async () => {
    const user = userEvent.setup();
    mockHomeRequests({
      sessionStatus: 200,
      session: authenticatedSessionResponse,
    });

    render(<HomePage />);

    const logoutButton = await screen.findByRole('button', { name: 'Log out' });
    await user.click(logoutButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/logout', { method: 'POST' }));
    await waitFor(() => expect(updateSharedSession).toHaveBeenCalled());
    expect(await screen.findByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByText('Welcome back, ada.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Outfolio' })).toBeInTheDocument();
  });

  it('shows an "Add your project" link instead of registration when an authenticated user has no published highlights', async () => {
    mockHomeRequests({
      sessionStatus: 200,
      session: authenticatedSessionResponse,
      dashboard: {
        ...dashboardResponse,
        session: { authenticated: true },
        publishedProjects: [],
      },
    });

    render(<HomePage />);

    expect(await screen.findByText('No published projects are available yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your project' })).toHaveAttribute('href', '/projects');
    expect(screen.queryByRole('link', { name: 'Register to add yours' })).not.toBeInTheDocument();
  });

  it('handles load errors without showing a 404 or missing page message', async () => {
    mockHomeRequests({ dashboardStatus: 500 });

    render(<HomePage />);

    expect(await screen.findByText('The home dashboard could not be loaded right now.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to discovery' })).toHaveAttribute('href', '/discover');
    expect(screen.queryByText(/404/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/missing page/i)).not.toBeInTheDocument();
  });
});
