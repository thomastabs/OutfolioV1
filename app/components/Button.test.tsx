import { render, screen } from '@testing-library/react';

import { Button } from './Button';

describe('Button', () => {
  it('renders children with themed button styling and default type', () => {
    render(<Button>Save draft</Button>);

    const button = screen.getByRole('button', { name: 'Save draft' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('button');
    expect(button).toHaveClass('button--primary');
    expect(button).toHaveAttribute('aria-disabled', 'false');
  });

  it('supports standard button props and variants', () => {
    const handleClick = jest.fn();
    render(
      <Button type="submit" variant="secondary" onClick={handleClick}>
        Publish
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Publish' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('button--secondary');
  });

  it('renders disabled state accessibly', () => {
    render(<Button disabled>Delete</Button>);

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
