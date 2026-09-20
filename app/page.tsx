'use client';

import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Compass, ImageIcon, LogIn, LogOut, Sparkles, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/app/components/ui/badge';
import { buttonVariants } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { cn } from '@/src/lib/utils';
import { useSession } from './session-context';

type ProjectHighlight = {
  id: string;
  title: string;
  slug?: string | null;
  summary?: string | null;
  coverImageUrl?: string | null;
  projectType?: string | null;
  tags?: string[] | null;
  role?: string | null;
  visibility?: string | null;
};

type DashboardSession =
  | {
      authenticated: true;
      username: string;
    }
  | {
      authenticated: false;
    };

type DashboardData = {
  productName: string;
  valueProposition: string;
  session: DashboardSession;
  publishedProjects: ProjectHighlight[];
};

type CurrentSessionResponse = {
  userId: string;
  username: string;
  email: string;
};

type DashboardState =
  | {
      status: 'loading';
      data?: never;
    }
  | {
      status: 'ready';
      data: DashboardData;
    }
  | {
      status: 'error';
      data?: never;
    };

function isProjectHighlight(value: unknown): value is ProjectHighlight {
  if (!value || typeof value !== 'object') return false;

  const project = value as Partial<ProjectHighlight>;
  return (
    typeof project.id === 'string' &&
    typeof project.title === 'string' &&
    (typeof project.slug === 'string' || project.slug === null || typeof project.slug === 'undefined') &&
    (typeof project.summary === 'string' || project.summary === null || typeof project.summary === 'undefined') &&
    (
      typeof project.coverImageUrl === 'string' ||
      project.coverImageUrl === null ||
      typeof project.coverImageUrl === 'undefined'
    ) &&
    (
      typeof project.projectType === 'string' ||
      project.projectType === null ||
      typeof project.projectType === 'undefined'
    ) &&
    (
      Array.isArray(project.tags) ||
      project.tags === null ||
      typeof project.tags === 'undefined'
    ) &&
    (
      typeof project.role === 'string' ||
      project.role === null ||
      typeof project.role === 'undefined'
    ) &&
    (
      typeof project.visibility === 'string' ||
      project.visibility === null ||
      typeof project.visibility === 'undefined'
    )
  );
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!value || typeof value !== 'object') return false;

  const dashboard = value as Partial<DashboardData>;
  const session = dashboard.session as Partial<DashboardSession> | undefined;

  return (
    typeof dashboard.productName === 'string' &&
    typeof dashboard.valueProposition === 'string' &&
    Boolean(session) &&
    typeof session?.authenticated === 'boolean' &&
    Array.isArray(dashboard.publishedProjects) &&
    dashboard.publishedProjects.every(isProjectHighlight)
  );
}

function isCurrentSessionResponse(value: unknown): value is CurrentSessionResponse {
  if (!value || typeof value !== 'object') return false;

  const session = value as Partial<CurrentSessionResponse>;
  return (
    typeof session.userId === 'string' &&
    typeof session.username === 'string' &&
    typeof session.email === 'string'
  );
}

async function loadCurrentSession(): Promise<DashboardSession> {
  try {
    const response = await fetch('/api/v1/auth/session');

    if (response.status === 401) {
      return { authenticated: false };
    }

    if (!response.ok) {
      return { authenticated: false };
    }

    const session = (await response.json()) as unknown;
    if (!isCurrentSessionResponse(session)) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      username: session.username,
    };
  } catch {
    return { authenticated: false };
  }
}

function ProjectHighlightCover({ project }: { project: ProjectHighlight }) {
  const [imageFailed, setImageFailed] = useState(false);
  const coverImageUrl = project.coverImageUrl?.trim();

  if (coverImageUrl && !imageFailed) {
    return (
      <img
        className="project-highlight-cover"
        src={coverImageUrl}
        alt={`${project.title} cover image`}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="project-highlight-placeholder" role="img" aria-label={`Placeholder image for ${project.title}`}>
      <ImageIcon className="h-7 w-7" aria-hidden="true" />
    </div>
  );
}

function canViewPublicProject(project: ProjectHighlight) {
  return project.visibility === 'PUBLISHED' && Boolean(project.slug?.trim());
}

function ProjectHighlightMetadata({ project }: { project: ProjectHighlight }) {
  const projectType = project.projectType?.trim();
  const role = project.role?.trim();
  const tags = (project.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

  if (!projectType && !role && tags.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2" aria-label={`Project metadata for ${project.title}`}>
      <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
        {projectType ? <span>{projectType}</span> : null}
        {projectType && role ? <span aria-hidden="true">/</span> : null}
        {role ? <span>{role}</span> : null}
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label={`Tags for ${project.title}`}>
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="px-2 py-0 text-[0.7rem]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  const { update: updateSharedSession } = useSession();
  const [dashboardState, setDashboardState] = useState<DashboardState>({ status: 'loading' });

  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      await updateSharedSession();
      setDashboardState((current) =>
        current.status === 'ready'
          ? { status: 'ready', data: { ...current.data, session: { authenticated: false } } }
          : current,
      );
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [response, session] = await Promise.all([
          fetch('/api/v1/home/dashboard'),
          loadCurrentSession(),
        ]);

        if (!response.ok) {
          throw new Error('Home dashboard request failed.');
        }

        const data = (await response.json()) as unknown;
        if (!isDashboardData(data)) {
          throw new Error('Home dashboard response was malformed.');
        }

        if (mounted) {
          setDashboardState({
            status: 'ready',
            data: {
              ...data,
              session,
            },
          });
        }
      } catch {
        if (mounted) {
          setDashboardState({ status: 'error' });
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  if (dashboardState.status === 'loading') {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <section
          className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center rounded-3xl border border-border bg-card shadow-polish"
          aria-busy="true"
        >
          <p className="text-sm font-medium text-muted-foreground">Loading home dashboard...</p>
        </section>
      </main>
    );
  }

  if (dashboardState.status === 'error') {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <section className="mx-auto grid max-w-4xl gap-6 rounded-3xl border border-border bg-card p-8 text-center shadow-polish">
          <Sparkles className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="text-4xl font-bold tracking-normal text-foreground">Outfolio</h1>
          <p className="text-muted-foreground">The home dashboard could not be loaded right now.</p>
          <Link href="/discover" className={cn(buttonVariants({ size: 'lg' }), 'mx-auto rounded-xl shadow')}>
            Go to discovery
          </Link>
        </section>
      </main>
    );
  }

  const { data } = dashboardState;

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <section className="mx-auto grid max-w-6xl gap-8 rounded-3xl border border-border bg-card p-8 shadow-polish md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="grid content-center gap-5">
          <Badge className="w-fit rounded-full shadow" variant="outline">
            <Sparkles className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Portfolio case studies for platform work
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-foreground md:text-6xl">{data.productName}</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">{data.valueProposition}</p>
        </div>

        <nav aria-label="Home navigation" className="grid content-center gap-3 rounded-2xl border border-border bg-muted/50 p-5 shadow">
          {data.session.authenticated ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">Welcome back, {data.session.username}.</p>
              <Link href="/profile" className={cn(buttonVariants(), 'rounded-xl shadow')}>
                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                Edit profile
              </Link>
              <Link href="/projects" className={cn(buttonVariants({ variant: 'secondary' }), 'rounded-xl shadow')}>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Manage projects
              </Link>
              <Link href="/discover" className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-xl')}>
                <Compass className="h-4 w-4" aria-hidden="true" />
                Discover projects
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-xl')}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/register" className={cn(buttonVariants(), 'rounded-xl shadow')}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Register
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: 'secondary' }), 'rounded-xl shadow')}>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Login
              </Link>
              <Link href="/discover" className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-xl')}>
                <Compass className="h-4 w-4" aria-hidden="true" />
                Discover projects
              </Link>
            </>
          )}
        </nav>
      </section>

      <section className="mx-auto mt-12 grid max-w-6xl gap-6" aria-labelledby="home-highlights-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge className="mb-3 w-fit rounded-full" variant="secondary">Highlights</Badge>
            <h2 id="home-highlights-heading" className="text-2xl font-bold tracking-normal text-foreground">
              Published project highlights
            </h2>
          </div>
          <Link href="/discover" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Browse all projects
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        {data.publishedProjects.length > 0 ? (
          <ul className="grid gap-5 md:grid-cols-3" aria-label="Published project highlights">
            {data.publishedProjects.map((project) => (
              <li key={project.id}>
                <Card className="project-highlight-card h-full rounded-2xl shadow transition hover:-translate-y-0.5 hover:shadow-polish">
                  <CardHeader className="project-highlight-card__body">
                    <ProjectHighlightCover project={project} />
                    <div className="project-highlight-card__copy">
                      <CardTitle>{project.title}</CardTitle>
                      <ProjectHighlightMetadata project={project} />
                      <CardDescription>{project.summary?.trim() || 'No summary added yet.'}</CardDescription>
                    </div>
                  </CardHeader>
                  {canViewPublicProject(project) ? (
                    <CardFooter className="pt-0">
                      <Link
                        href={`/project/${project.slug}`}
                        className={cn(buttonVariants({ variant: 'secondary' }), 'w-full rounded-xl shadow-sm sm:w-auto')}
                        aria-label={`View full project: ${project.title}`}
                      >
                        View full project
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </CardFooter>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="rounded-2xl border-dashed shadow">
            <CardContent className="grid gap-4 p-6 text-center">
              <Compass className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <p className="text-muted-foreground">No published projects are available yet.</p>
              <div className="flex flex-wrap justify-center gap-3">
                {data.session.authenticated ? (
                  <Link href="/projects" className={cn(buttonVariants(), 'rounded-xl shadow')}>Add your project</Link>
                ) : (
                  <Link href="/register" className={cn(buttonVariants(), 'rounded-xl shadow')}>Register to add yours</Link>
                )}
                <Link href="/discover" className={cn(buttonVariants({ variant: 'secondary' }), 'rounded-xl shadow')}>
                  Explore discovery
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
