'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type PublicProject = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  projectType: string;
  role: string;
  status: string;
  tags: string[];
  coverImageUrl: string;
  problem: string;
  features: string;
  technicalNotes: string;
  contribution: string;
  outcome: string;
  visibility: string;
  publishedAt: string | Date | null;
  owner: {
    username: string;
    name: string;
  };
};

type LoadState = 'loading' | 'ready' | 'access-denied' | 'not-found' | 'error';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || 'Not added yet.'}</dd>
    </div>
  );
}

export default function PublicProjectPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [state, setState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProject() {
      setState('loading');
      setProject(null);

      try {
        const response = await fetch(`/api/v1/public/project/${encodeURIComponent(slug)}`);

        if (!isActive) return;

        if (response.status === 403) {
          setState('access-denied');
          return;
        }

        if (response.status === 404) {
          setState('not-found');
          return;
        }

        if (!response.ok) {
          setState('error');
          return;
        }

        const data = (await response.json()) as PublicProject;
        setProject(data);
        setState('ready');
      } catch {
        if (isActive) {
          setState('error');
        }
      }
    }

    loadProject();

    return () => {
      isActive = false;
    };
  }, [slug]);

  if (state === 'loading') {
    return <p>Loading project...</p>;
  }

  if (state === 'access-denied') {
    return (
      <main className="page-shell public-project-page">
        <h1>Access denied</h1>
        <p>This project is unpublished or private.</p>
      </main>
    );
  }

  if (state === 'not-found') {
    return (
      <main className="page-shell public-project-page">
        <h1>Project not found</h1>
        <p>This project does not exist or is unavailable.</p>
      </main>
    );
  }

  if (state === 'error' || !project) {
    return (
      <main className="page-shell public-project-page">
        <h1>Project unavailable</h1>
        <p>The project could not be loaded.</p>
      </main>
    );
  }

  return (
    <main className="page-shell public-project-page">
      <article className="responsive-section public-project-article" aria-label={`${project.title} public project`}>
        <header>
          <p>{project.owner.name || project.owner.username}</p>
          <h1>{project.title}</h1>
          <p>{project.summary || 'No summary added yet.'}</p>
        </header>

        {project.coverImageUrl ? (
          <img src={project.coverImageUrl} alt={`${project.title} cover image`} />
        ) : (
          <p>No cover image added yet.</p>
        )}

        <dl className="responsive-definition-grid">
          <Field label="Project type" value={project.projectType} />
          <Field label="Role" value={project.role} />
          <Field label="Status" value={project.status} />
        </dl>

        <section aria-label="Project tags">
          <h2>Tags</h2>
          {project.tags.length > 0 ? (
            <ul className="responsive-tag-list">
              {project.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : (
            <p>No tags added yet.</p>
          )}
        </section>

        <section>
          <h2>Problem</h2>
          <p>{project.problem || 'Not added yet.'}</p>
        </section>

        <section>
          <h2>Features</h2>
          <p>{project.features || 'Not added yet.'}</p>
        </section>

        <section>
          <h2>Technical notes</h2>
          <p>{project.technicalNotes || 'Not added yet.'}</p>
        </section>

        <section>
          <h2>Contribution</h2>
          <p>{project.contribution || 'Not added yet.'}</p>
        </section>

        <section>
          <h2>Outcome</h2>
          <p>{project.outcome || 'Not added yet.'}</p>
        </section>
      </article>
    </main>
  );
}
