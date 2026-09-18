'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { ProjectSummary } from '@/src/api/v1/discover/projects';

type LoadState = 'loading' | 'ready' | 'error';

function buildDiscoveryUrl(projectType: string, keyword: string) {
  const params = new URLSearchParams();
  const trimmedProjectType = projectType.trim();
  const trimmedKeyword = keyword.trim();

  if (trimmedProjectType) {
    params.set('projectType', trimmedProjectType);
  }

  if (trimmedKeyword) {
    params.set('keyword', trimmedKeyword);
  }

  const query = params.toString();
  return query ? `/api/v1/discover/projects?${query}` : '/api/v1/discover/projects';
}

function DiscoveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [projectType, setProjectType] = useState(() => searchParams.get('projectType') ?? '');
  const [keyword, setKeyword] = useState('');
  const requestUrl = useMemo(() => buildDiscoveryUrl(projectType, keyword), [projectType, keyword]);

  function updateProjectType(nextProjectType: string) {
    setProjectType(nextProjectType);

    const params = new URLSearchParams();
    const trimmedProjectType = nextProjectType.trim();

    if (trimmedProjectType) {
      params.set('projectType', trimmedProjectType);
    }

    const query = params.toString();
    router.replace(query ? `/discover?${query}` : '/discover', { scroll: false });
  }

  useEffect(() => {
    let isActive = true;

    async function loadProjects() {
      setState('loading');

      try {
        const response = await fetch(requestUrl);

        if (!isActive) return;

        if (!response.ok) {
          setState('error');
          return;
        }

        const data = (await response.json()) as { projects: ProjectSummary[] };
        setProjects(data.projects);
        setState('ready');
      } catch {
        if (isActive) {
          setState('error');
        }
      }
    }

    loadProjects();

    return () => {
      isActive = false;
    };
  }, [requestUrl]);

  return (
    <main className="page-shell discovery-page">
      <h1>Discover projects</h1>

      <section aria-labelledby="discovery-filters-heading">
        <h2 id="discovery-filters-heading" className="visually-hidden">Filter projects</h2>
        <form className="responsive-controls discovery-controls">
        <label htmlFor="project-type">Project type</label>
        <select
          id="project-type"
          value={projectType}
          onChange={(event) => updateProjectType(event.target.value)}
        >
          <option value="">All project types</option>
          <option value="OutSystems">OutSystems</option>
          <option value="Next.js">Next.js</option>
          <option value="React">React</option>
          <option value="API">API</option>
        </select>

        <label htmlFor="keyword-search">Keyword search</label>
        <input
          id="keyword-search"
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        </form>
      </section>

      {state === 'loading' ? <p>Loading projects...</p> : null}

      {state === 'error' ? <p>Published projects could not be loaded.</p> : null}

      {state === 'ready' && projects.length === 0 ? (
        <p>
          {keyword.trim()
            ? 'No published projects found for this search.'
            : projectType
            ? 'No published projects found for this filter.'
            : 'No published projects are currently available for browsing.'}
        </p>
      ) : null}

      {state === 'ready' && projects.length > 0 ? (
        <section aria-labelledby="discovery-results-heading">
          <h2 id="discovery-results-heading" className="visually-hidden">Published projects</h2>
          <ul className="responsive-card-grid discovery-results" aria-label="Published projects">
            {projects.map((project) => (
              <li className="responsive-card" key={project.id}>
                <h3>
                  <a href={`/project/${encodeURIComponent(project.slug)}`}>{project.title}</a>
                </h3>
                <p>{project.summary || 'No summary added yet.'}</p>
                <p>{project.developerName}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={<p>Loading projects...</p>}>
      <DiscoveryContent />
    </Suspense>
  );
}
