'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PublishedProjectCard } from './components/PublishedProjectCard';

type ProjectHighlight = {
  id: string;
  title: string;
  summary?: string | null;
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
    (typeof project.summary === 'string' || project.summary === null || typeof project.summary === 'undefined')
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

export default function HomePage() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({ status: 'loading' });

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
      <main className="home-page">
        <section className="home-hero" aria-busy="true">
          <p>Loading home dashboard...</p>
        </section>
      </main>
    );
  }

  if (dashboardState.status === 'error') {
    return (
      <main className="home-page">
        <section className="home-hero">
          <h1>Outfolio</h1>
          <p>The home dashboard could not be loaded right now.</p>
          <Link href="/discover" className="home-primary-link">
            Go to discovery
          </Link>
        </section>
      </main>
    );
  }

  const { data } = dashboardState;

  return (
    <main className="home-page">
      <section className="home-hero">
        <div>
          <h1>{data.productName}</h1>
          <p>{data.valueProposition}</p>
        </div>

        <nav aria-label="Home navigation" className="home-actions">
          {data.session.authenticated ? (
            <>
              <p>Welcome back, {data.session.username}.</p>
              <Link href="/profile">Edit profile</Link>
              <Link href="/projects">Manage projects</Link>
              <Link href="/discover">Discover projects</Link>
            </>
          ) : (
            <>
              <Link href="/register">Register</Link>
              <Link href="/login">Login</Link>
              <Link href="/discover">Discover projects</Link>
            </>
          )}
        </nav>
      </section>

      <section className="home-highlights" aria-labelledby="home-highlights-heading">
        <h2 id="home-highlights-heading">Published project highlights</h2>
        {data.publishedProjects.length > 0 ? (
          <ul aria-label="Published project highlights">
            {data.publishedProjects.map((project) => (
              <li key={project.id}>
                <PublishedProjectCard title={project.title} summary={project.summary} />
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <p>No published projects are available yet.</p>
            <Link href="/register">Register to add yours</Link>
            <Link href="/discover">Explore discovery</Link>
          </div>
        )}
      </section>
    </main>
  );
}
