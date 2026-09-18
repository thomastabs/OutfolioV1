import { buttonVariants } from './button';

describe('buttonVariants', () => {
  it('gives the ghost variant an explicit background so it beats the legacy global `button { background }` rule', () => {
    // A plain `<button>` element (not a styled `<Link>`) is subject to a
    // legacy rule in colors-shapes.css that fills every bare `button` with
    // a solid primary background. Every Tailwind utility class has higher
    // specificity than that element selector, so the ghost variant needs
    // its own explicit background utility at rest, not just on hover, or a
    // real <button> using it renders as an unreadable solid block.
    expect(buttonVariants({ variant: 'ghost' })).toContain('bg-transparent');
  });

  it('gives default, secondary, and destructive variants their own resting background', () => {
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary');
    expect(buttonVariants({ variant: 'secondary' })).toContain('bg-card');
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-destructive');
  });
});
