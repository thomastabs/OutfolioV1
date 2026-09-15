import { render, screen, waitFor } from '@testing-library/react';
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
    sessionState = {
      status: 'authenticated',
      data: { user: { email: 'ada@example.com' } },
    };
  });

  it('shows the profile workspace for authenticated users', () => {
    render(<ProfilePage />);

    expect(screen.getByText('Profile workspace')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users to login', async () => {
    sessionState = { status: 'unauthenticated', data: null };

    render(<ProfilePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
