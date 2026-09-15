import { render, screen, waitFor } from '@testing-library/react';
import PublicDeveloperProfilePage from './page';

let routeParams = { username: 'ada' };

jest.mock('next/navigation', () => ({
  useParams: () => routeParams,
}));

describe('PublicDeveloperProfilePage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    routeParams = { username: 'ada' };
  });

  it('fetches and displays a public profile with published projects', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        username: 'ada',
        profile: {
          userId: 'user-1',
          name: 'Ada Lovelace',
          bio: 'Builds rigorous developer tools.',
          experienceYears: 7,
          certifications: ['OutSystems Associate Reactive Developer'],
          links: ['https://example.com/ada'],
          visibility: 'public',
        },
        publishedProjects: [
          {
            id: 'project-1',
            title: 'Portfolio Builder',
            slug: 'portfolio-builder',
            summary: 'A project documentation workspace.',
          },
        ],
      }),
    } as Response);

    render(<PublicDeveloperProfilePage />);

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/profile/public/ada'));
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('Builds rigorous developer tools.')).toBeInTheDocument();
    expect(screen.getByText('7 years')).toBeInTheDocument();
    expect(screen.getByText('OutSystems Associate Reactive Developer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://example.com/ada' })).toHaveAttribute('href', 'https://example.com/ada');
    expect(screen.getByRole('heading', { name: 'Published projects' })).toBeInTheDocument();
    expect(screen.getByText('Portfolio Builder')).toBeInTheDocument();
    expect(screen.getByText('A project documentation workspace.')).toBeInTheDocument();
  });

  it('displays public profile information when there are no published projects', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        username: 'ada',
        profile: {
          userId: 'user-1',
          name: 'Ada Lovelace',
          bio: 'Builds rigorous developer tools.',
          experienceYears: 7,
          certifications: ['OutSystems Associate Reactive Developer'],
          links: ['https://example.com/ada'],
          visibility: 'public',
        },
        publishedProjects: [],
      }),
    } as Response);

    render(<PublicDeveloperProfilePage />);

    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('No published projects yet.')).toBeInTheDocument();
  });

  it('shows an unavailable message when the profile is private', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'profile_not_public' }),
    } as Response);

    render(<PublicDeveloperProfilePage />);

    expect(await screen.findByText('Profile is unavailable.')).toBeInTheDocument();
  });

  it('shows an unavailable message when the profile does not exist', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not_found' }),
    } as Response);

    render(<PublicDeveloperProfilePage />);

    expect(await screen.findByText('Profile is unavailable.')).toBeInTheDocument();
  });

  it('shows a generic message for unexpected API failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'unexpected_failure' }),
    } as Response);

    render(<PublicDeveloperProfilePage />);

    expect(await screen.findByText('Public profile could not be loaded.')).toBeInTheDocument();
  });
});
