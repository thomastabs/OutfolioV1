import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/src/lib/utils';

export const buttonVariants = cva(
  // appearance-none strips WebKit's native button chrome (Tailwind's
  // preflight only sets `-webkit-appearance: button`, not `none`). Without
  // it, WebKit renders long button labels (e.g. "Unpublish {project title}")
  // as fixed-size native controls that refuse to wrap, overflowing the
  // viewport horizontally on narrow screens even though the same label
  // wraps fine in Chromium. min-h- (not h-) on each size lets a wrapped
  // two-line label grow the button instead of being clipped.
  'inline-flex appearance-none items-center justify-center gap-2 whitespace-normal rounded-lg text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        secondary: 'border border-border bg-card text-foreground shadow-sm hover:bg-muted',
        ghost: 'bg-transparent text-primary hover:bg-primary/10',
        destructive: 'bg-destructive text-destructive-foreground shadow hover:bg-destructive/90',
      },
      size: {
        default: 'min-h-10 px-4 py-2',
        sm: 'min-h-9 rounded-md px-3',
        lg: 'min-h-11 rounded-xl px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
  ),
);

Button.displayName = 'Button';
