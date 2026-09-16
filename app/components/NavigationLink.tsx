import type { AnchorHTMLAttributes, ReactNode } from 'react';

export type NavigationLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  disabled?: boolean;
  href: string;
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

/**
 * Theme-backed navigation anchor for primary app links.
 * Disabled links are removed from tab order and omit `href`.
 */
export function NavigationLink({
  children,
  className,
  disabled = false,
  href,
  onClick,
  ...props
}: NavigationLinkProps) {
  return (
    <a
      {...props}
      aria-disabled={disabled}
      className={joinClassNames('navigation-link', className)}
      href={disabled ? undefined : href}
      onClick={disabled ? undefined : onClick}
      tabIndex={disabled ? -1 : props.tabIndex}
    >
      {children}
    </a>
  );
}
