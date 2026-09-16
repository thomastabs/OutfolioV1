export type PublishedProjectCardProps = {
  title: string;
  summary?: string | null;
};

export function PublishedProjectCard({ title, summary }: PublishedProjectCardProps) {
  const displaySummary = summary?.trim() || 'No summary available.';

  return (
    <article className="published-project-card">
      <h3>{title}</h3>
      <p>{displaySummary}</p>
    </article>
  );
}
