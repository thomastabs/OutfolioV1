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

  it('lets long labels (e.g. "Unpublish {project title}") wrap instead of overflowing on narrow viewports', () => {
    // Tailwind's preflight sets `-webkit-appearance: button`, not `none`,
    // so WebKit renders an un-appearance-reset button as a native control
    // that keeps its label on one line regardless of available width -
    // it doesn't overflow in Chromium, only WebKit (caught by the iPhone
    // 13 / iPad Pro 11 E2E projects, Story 9563524). appearance-none plus
    // an explicit whitespace-normal neutralizes that, and a min-h- (not
    // fixed h-) size lets a wrapped two-line label grow the button instead
    // of being clipped.
    const classes = buttonVariants({ size: 'default' });
    expect(classes).toContain('appearance-none');
    expect(classes).toContain('whitespace-normal');
    expect(classes).not.toMatch(/(?<!min-)\bh-10\b/);
  });
});
