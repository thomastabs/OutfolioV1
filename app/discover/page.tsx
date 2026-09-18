'use client';

import Link from 'next/link';
import { ArrowRight, Compass, Filter, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
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
    <main className="min-h-screen bg-background px-6 py-10">
      <section className="mx-auto grid max-w-6xl gap-8">
        <header className="rounded-3xl border border-border bg-card p-8 shadow-polish">
          <Badge className="mb-4 w-fit rounded-full shadow" variant="outline">
            <Compass className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Discovery
          </Badge>
          <h1 className="text-4xl font-bold tracking-normal text-foreground">Discover projects</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Browse published Outfolio case studies and find work by type or keyword.
          </p>
        </header>

      <Card className="rounded-3xl shadow" aria-labelledby="discovery-filters-heading">
        <CardHeader>
        <h2 id="discovery-filters-heading" className="visually-hidden">Filter projects</h2>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" aria-hidden="true" />
            Filter projects
          </CardTitle>
          <CardDescription>Use simple filters to narrow the public gallery.</CardDescription>
        </CardHeader>
        <CardContent>
        <form className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold" htmlFor="project-type">Project type</label>
        <select
          id="project-type"
          className="h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
          value={projectType}
          onChange={(event) => updateProjectType(event.target.value)}
        >
          <option value="">All project types</option>
          <option value="OutSystems">OutSystems</option>
          <option value="Next.js">Next.js</option>
          <option value="React">React</option>
          <option value="API">API</option>
        </select>

        <label className="grid gap-2 text-sm font-semibold" htmlFor="keyword-search">Keyword search</label>
        <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          className="pl-9"
          id="keyword-search"
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        </div>
        </form>
        </CardContent>
      </Card>

      {state === 'loading' ? <p className="rounded-2xl border border-border bg-card p-6 text-sm font-medium text-muted-foreground shadow">Loading projects...</p> : null}

      {state === 'error' ? <p className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm font-medium text-destructive shadow">Published projects could not be loaded.</p> : null}

      {state === 'ready' && projects.length === 0 ? (
        <Card className="rounded-2xl border-dashed shadow">
          <CardContent className="grid gap-4 p-6 text-center">
            <Search className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <p className="font-medium">
              {keyword.trim()
                ? 'No published projects found for this search.'
                : projectType
                ? 'No published projects found for this filter.'
                : 'No published projects are currently available for browsing.'}
            </p>
            <Link className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary" href="/">
              Back to home
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {state === 'ready' && projects.length > 0 ? (
        <section aria-labelledby="discovery-results-heading">
          <h2 id="discovery-results-heading" className="visually-hidden">Published projects</h2>
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Published projects">
            {projects.map((project) => (
              <li key={project.id}>
                <Card className="h-full rounded-2xl shadow transition hover:-translate-y-0.5 hover:shadow-polish">
                  <CardHeader>
                    <CardTitle>
                      <a href={`/project/${encodeURIComponent(project.slug)}`}>{project.title}</a>
                    </CardTitle>
                    <CardDescription>{project.summary || 'No summary added yet.'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-muted-foreground">{project.developerName}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </section>
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
