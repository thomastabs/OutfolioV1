import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiscoveryPage from './page';

const replace = jest.fn();
let searchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

const projectList = [
  {
    id: 'project-1',
    title: 'Portfolio Builder',
    slug: 'portfolio-builder',
    summary: 'A project documentation workspace.',
    developerName: 'Ada Lovelace',
  },
  {
    id: 'project-2',
    title: 'API Case Study',
    slug: 'api-case-study',
    summary: 'Reusable API documentation.',
    developerName: 'Grace Hopper',
  },
];

describe('DiscoveryPage', () => {
  beforeEach(() => {
    replace.mockClear();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    searchParams = new URLSearchParams();
  });

  it('fetches and displays published projects', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ projects: projectList }),
    } as Response);

    render(<DiscoveryPage />);

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/discover/projects'));
    const list = await screen.findByRole('list', { name: 'Published projects' });
    expect(within(list).getByRole('link', { name: 'Portfolio Builder' })).toHaveAttribute('href', '/project/portfolio-builder');
    expect(within(list).getByText('A project documentation workspace.')).toBeInTheDocument();
    expect(within(list).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'API Case Study' })).toHaveAttribute('href', '/project/api-case-study');
    expect(within(list).getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('shows a no-projects message when no projects are available', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ projects: [] }),
    } as Response);

    render(<DiscoveryPage />);

    expect(await screen.findByText('No published projects are currently available for browsing.')).toBeInTheDocument();
  });

  it('does not render unpublished or private projects when the API excludes them', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ projects: [projectList[0]] }),
    } as Response);

    render(<DiscoveryPage />);

    expect(await screen.findByText('Portfolio Builder')).toBeInTheDocument();
    expect(screen.queryByText('Unpublished Internal App')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Client Portal')).not.toBeInTheDocument();
  });

  it('shows an error message when projects cannot be loaded', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'unexpected_failure' }),
    } as Response);

    render(<DiscoveryPage />);

    expect(await screen.findByText('Published projects could not be loaded.')).toBeInTheDocument();
  });

  it('fetches projects with the selected project type filter', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ projects: projectList }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ projects: [projectList[0]] }),
      } as Response);

    render(<DiscoveryPage />);

    await screen.findByText('Portfolio Builder');
    await user.selectOptions(screen.getByLabelText('Project type'), 'OutSystems');

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/v1/discover/projects?projectType=OutSystems'));
    expect(replace).toHaveBeenCalledWith('/discover?projectType=OutSystems', { scroll: false });
  });

  it('initializes the project type filter from the URL query parameter', async () => {
    searchParams = new URLSearchParams('projectType=Next.js');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ projects: [projectList[1]] }),
    } as Response);

    render(<DiscoveryPage />);

    expect(screen.getByLabelText('Project type')).toHaveValue('Next.js');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/discover/projects?projectType=Next.js'));
    expect(await screen.findByText('API Case Study')).toBeInTheDocument();
  });

  it('shows a filtered no-projects message when a project type has no matches', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ projects: projectList }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ projects: [] }),
      } as Response);

    render(<DiscoveryPage />);

    await screen.findByText('Portfolio Builder');
    await user.selectOptions(screen.getByLabelText('Project type'), 'React');

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/v1/discover/projects?projectType=React'));
    expect(await screen.findByText('No published projects found for this filter.')).toBeInTheDocument();
  });

  it('fetches projects with keyword search', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/discover/projects?keyword=api') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ projects: [projectList[1]] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ projects: projectList }),
      } as Response;
    });

    render(<DiscoveryPage />);

    await screen.findByText('Portfolio Builder');
    await user.type(screen.getByLabelText('Keyword search'), 'api');

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/v1/discover/projects?keyword=api'));
    expect(await screen.findByText('API Case Study')).toBeInTheDocument();
  });

  it('shows a search no-projects message when keyword search has no matches', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/discover/projects?keyword=missing') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ projects: [] }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ projects: projectList }),
      } as Response;
    });

    render(<DiscoveryPage />);

    await screen.findByText('Portfolio Builder');
    await user.type(screen.getByLabelText('Keyword search'), 'missing');

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/v1/discover/projects?keyword=missing'));
    expect(await screen.findByText('No published projects found for this search.')).toBeInTheDocument();
  });
});
