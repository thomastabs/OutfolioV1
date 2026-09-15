import { render, screen, waitFor, within } from '@testing-library/react';
import ProfilePage from './page';

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

describe('ProfilePage session guard', () => {
  beforeEach(() => {
    replace.mockClear();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    sessionState = {
      status: 'authenticated',
      data: { user: { email: 'ada@example.com' } },
    };
  });

  it('fetches and displays all populated profile fields for authenticated users', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: 'user-1',
        name: 'Ada Lovelace',
        bio: 'Builds rigorous developer tools.',
        experienceYears: 7,
        certifications: ['OutSystems Associate Reactive Developer', 'AWS Developer'],
        links: ['https://example.com/ada', 'https://github.com/ada'],
        visibility: 'public',
      }),
    } as Response);

    render(<ProfilePage />);

    expect(screen.getByText('Profile workspace')).toBeInTheDocument();
    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/profile/me'));
    const profileSection = await screen.findByRole('region', { name: /developer profile/i });
    expect(within(profileSection).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(profileSection).getByText('Builds rigorous developer tools.')).toBeInTheDocument();
    expect(within(profileSection).getByText('7 years')).toBeInTheDocument();
    expect(within(profileSection).getByText('Public')).toBeInTheDocument();
    expect(within(profileSection).getByText('OutSystems Associate Reactive Developer')).toBeInTheDocument();
    expect(within(profileSection).getByText('AWS Developer')).toBeInTheDocument();
    expect(within(profileSection).getByRole('link', { name: 'https://example.com/ada' })).toHaveAttribute('href', 'https://example.com/ada');
    expect(within(profileSection).getByRole('link', { name: 'https://github.com/ada' })).toHaveAttribute('href', 'https://github.com/ada');
  });

  it('shows placeholders when profile fields are empty', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: 'user-1',
        name: '',
        bio: '',
        experienceYears: 0,
        certifications: [],
        links: [],
        visibility: 'private',
      }),
    } as Response);

    render(<ProfilePage />);

    expect(await screen.findByText('No name added yet')).toBeInTheDocument();
    expect(screen.getByText('No bio added yet')).toBeInTheDocument();
    expect(screen.getByText('No experience added yet')).toBeInTheDocument();
    expect(screen.getByText('No certifications added yet')).toBeInTheDocument();
    expect(screen.getByText('No links added yet')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    sessionState = { status: 'unauthenticated', data: null };

    render(<ProfilePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Profile workspace')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a loading state while the session is being determined', () => {
    sessionState = { status: 'loading', data: null };

    render(<ProfilePage />);

    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByText('Profile workspace')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('redirects to login when profile fetch is unauthorized', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'missing_or_invalid_auth' }),
    } as Response);

    render(<ProfilePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('shows a profile missing message when no profile exists', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not_found' }),
    } as Response);

    render(<ProfilePage />);

    expect(await screen.findByText('No profile has been created yet.')).toBeInTheDocument();
  });
});
