import { render, screen, waitFor } from '@testing-library/react';
import ProjectsPage from './page';

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

describe('ProjectsPage session guard', () => {
  beforeEach(() => {
    replace.mockClear();
    sessionState = {
      status: 'authenticated',
      data: { user: { email: 'ada@example.com' } },
    };
  });

  it('shows the project management workspace for authenticated users', () => {
    render(<ProjectsPage />);

    expect(screen.getByText('Project management workspace')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users to login without rendering the workspace', async () => {
    sessionState = { status: 'unauthenticated', data: null };

    render(<ProjectsPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Project management workspace')).not.toBeInTheDocument();
  });

  it('shows a loading state while the session is being determined', () => {
    sessionState = { status: 'loading', data: null };

    render(<ProjectsPage />);

    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByText('Project management workspace')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
