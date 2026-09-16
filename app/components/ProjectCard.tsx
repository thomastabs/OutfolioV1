import type { ReactNode } from 'react';

export type ProjectCardProps = {
  actions?: ReactNode;
  href?: string;
  summary?: string | null;
  title: string;
};

/**
 * Theme-backed project summary card for public and workspace project lists.
 */
export function ProjectCard({ actions, href, summary, title }: ProjectCardProps) {
  const titleContent = href ? <a href={href}>{title}</a> : title;
  const displaySummary = summary?.trim();

  return (
    <article className="project-card" tabIndex={href ? undefined : 0}>
      <h3>{titleContent}</h3>
      {displaySummary ? <p>{displaySummary}</p> : null}
      {actions ? <div className="project-card__actions">{actions}</div> : null}
    </article>
  );
}
