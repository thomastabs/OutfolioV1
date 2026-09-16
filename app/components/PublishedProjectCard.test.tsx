import { render, screen } from '@testing-library/react';

import { PublishedProjectCard } from './PublishedProjectCard';

describe('PublishedProjectCard', () => {
  it('renders a published project title and summary', () => {
    render(
      <PublishedProjectCard
        title="Portfolio Builder"
        summary="A documentation workspace for portfolio projects."
      />,
    );

    expect(screen.getByRole('heading', { name: 'Portfolio Builder' })).toBeInTheDocument();
    expect(screen.getByText('A documentation workspace for portfolio projects.')).toBeInTheDocument();
  });

  it('shows a clean placeholder when the summary is missing', () => {
    render(<PublishedProjectCard title="Untitled Summary" summary={null} />);

    expect(screen.getByRole('heading', { name: 'Untitled Summary' })).toBeInTheDocument();
    expect(screen.getByText('No summary available.')).toBeInTheDocument();
  });

  it('shows a clean placeholder when the summary is empty', () => {
    render(<PublishedProjectCard title="Empty Summary" summary="  " />);

    expect(screen.getByRole('heading', { name: 'Empty Summary' })).toBeInTheDocument();
    expect(screen.getByText('No summary available.')).toBeInTheDocument();
  });
});
