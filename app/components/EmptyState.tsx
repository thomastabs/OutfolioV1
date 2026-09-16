import type { ReactNode } from 'react';

export type EmptyStateProps = {
  children?: ReactNode;
  message?: string;
};

/**
 * Theme-backed empty state for lists with no available records.
 */
export function EmptyState({ children, message = 'Nothing to show yet.' }: EmptyStateProps) {
  return (
    <section className="empty-state" role="status" aria-live="polite">
      <p>{message}</p>
      {children ? <div className="empty-state__actions">{children}</div> : null}
    </section>
  );
}
