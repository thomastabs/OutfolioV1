import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

/**
 * Theme-backed button for Outfolio actions.
 * Uses global `.button` styles from `app/styles/colors-shapes.css`.
 */
export function Button({
  children,
  className,
  disabled = false,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-disabled={disabled}
      className={joinClassNames('button', `button--${variant}`, className)}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
}
