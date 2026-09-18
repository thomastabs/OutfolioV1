import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackButton } from './back-button';

const back = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
}));

describe('BackButton', () => {
  beforeEach(() => {
    back.mockClear();
  });

  it('renders a labelled back control', () => {
    render(<BackButton />);

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('navigates back in history when clicked', async () => {
    const user = userEvent.setup();
    render(<BackButton />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(back).toHaveBeenCalledTimes(1);
  });
});
