import { render, screen } from '@testing-library/react';

import { ValidationMessage } from './ValidationMessage';

describe('ValidationMessage', () => {
  it('renders an accessible themed error message', () => {
    render(<ValidationMessage message="Username is required." />);

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Username is required.');
    expect(message).toHaveClass('validation-message');
    expect(message).toHaveClass('validation-message--error');
  });

  it('renders a themed warning message', () => {
    render(<ValidationMessage type="warning" message="This profile is private." />);

    const message = screen.getByRole('status');
    expect(message).toHaveTextContent('This profile is private.');
    expect(message).toHaveClass('validation-message--warning');
  });
});
