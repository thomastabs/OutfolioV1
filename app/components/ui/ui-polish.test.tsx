import { render, screen } from '@testing-library/react';
import { Sparkles } from 'lucide-react';

import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Textarea } from './textarea';

describe('Story 9556465 shadcn-style UI primitives', () => {
  it('renders shared primitives and lucide icons for the polished UI layer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Polished surface</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge>Modern</Badge>
          <Button>
            <Sparkles data-testid="sparkles-icon" aria-hidden="true" />
            Save
          </Button>
          <Input aria-label="Project title" />
          <Textarea aria-label="Project summary" />
        </CardContent>
      </Card>,
    );

    expect(screen.getByText('Polished surface')).toBeInTheDocument();
    expect(screen.getByText('Modern')).toHaveClass('rounded-full');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('rounded-lg');
    expect(screen.getByTestId('sparkles-icon')).toHaveClass('lucide-sparkles');
    expect(screen.getByRole('textbox', { name: 'Project title' })).toHaveClass('border-input');
    expect(screen.getByRole('textbox', { name: 'Project summary' })).toHaveClass('min-h-28');
  });
});
