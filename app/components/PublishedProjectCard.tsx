import { ProjectCard } from './ProjectCard';

export type PublishedProjectCardProps = {
  title: string;
  summary?: string | null;
};

export function PublishedProjectCard({ title, summary }: PublishedProjectCardProps) {
  const displaySummary = summary?.trim() || 'No summary available.';

  return <ProjectCard title={title} summary={displaySummary} />;
}
