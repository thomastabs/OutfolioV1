import { render, screen } from '@testing-library/react';

import { FormInput, FormTextarea } from './FormInput';

describe('FormInput components', () => {
  it('renders a themed text input with standard props', () => {
    render(<FormInput id="username" name="username" placeholder="Username" aria-label="Username" />);

    const input = screen.getByRole('textbox', { name: 'Username' });
    expect(input).toHaveAttribute('id', 'username');
    expect(input).toHaveAttribute('name', 'username');
    expect(input).toHaveClass('form-input');
  });

  it('renders a themed textarea with standard props', () => {
    render(<FormTextarea id="bio" name="bio" placeholder="Bio" aria-label="Bio" />);

    const textarea = screen.getByRole('textbox', { name: 'Bio' });
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveClass('form-input');
    expect(textarea).toHaveClass('form-input--textarea');
  });

  it('renders disabled input state accessibly', () => {
    render(<FormInput disabled aria-label="Email" />);

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-disabled', 'true');
  });
});
