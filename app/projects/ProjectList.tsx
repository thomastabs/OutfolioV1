'use client';

export type ProjectSummary = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  role: string;
  status: string;
  visibility: string;
};

type ProjectListProps = {
  projects: ProjectSummary[];
  status: 'loading' | 'ready' | 'error';
};

function visibilityLabel(visibility: string) {
  return visibility.charAt(0).toUpperCase() + visibility.slice(1);
}

export function ProjectList({ projects, status }: ProjectListProps) {
  if (status === 'loading') {
    return <p>Loading projects...</p>;
  }

  if (status === 'error') {
    return <p>Projects could not be loaded.</p>;
  }

  if (projects.length === 0) {
    return <p>No projects yet.</p>;
  }

  return (
    <section aria-label="Project list">
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{project.status}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{visibilityLabel(project.visibility)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
