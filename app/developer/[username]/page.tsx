'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Link as LinkIcon, Shield, UserRound } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackButton } from '@/app/components/ui/back-button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { buttonVariants } from '@/app/components/ui/button';
import { cn } from '@/src/lib/utils';

type PublicProfileResponse = {
  username: string;
  profile: {
    userId: string;
    name: string;
    bio: string;
    experienceYears: number;
    certifications: string[];
    links: string[];
    visibility: string;
  };
  publishedProjects: Array<{
    id: string;
    title: string;
    slug: string;
    summary: string | null;
  }>;
};

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

export default function PublicDeveloperProfilePage() {
  const params = useParams<{ username: string }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PublicProfileResponse | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      setState('loading');
      setData(null);

      try {
        const response = await fetch(`/api/v1/profile/public/${encodeURIComponent(username)}`);

        if (!isActive) return;

        if (response.status === 403 || response.status === 404) {
          setState('unavailable');
          return;
        }

        if (!response.ok) {
          setState('error');
          return;
        }

        const profile = (await response.json()) as PublicProfileResponse;
        setData(profile);
        setState('ready');
      } catch {
        if (isActive) {
          setState('error');
        }
      }
    }

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [username]);

  if (state === 'loading') {
    return <p className="p-8 text-sm font-medium text-muted-foreground">Loading profile...</p>;
  }

  if (state === 'unavailable') {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <BackButton className="mx-auto mb-6" />
        <Card className="mx-auto max-w-3xl rounded-3xl text-center shadow-polish">
          <CardContent className="grid gap-4 p-8">
            <UserRound className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
            <h1 className="text-3xl font-bold tracking-normal">Profile is unavailable.</h1>
            <Link className={cn(buttonVariants({ variant: 'secondary' }), 'mx-auto rounded-xl shadow')} href="/discover">
              Back to discovery
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (state === 'error' || !data) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <BackButton className="mx-auto mb-6" />
        <Card className="mx-auto max-w-3xl rounded-3xl text-center shadow-polish">
          <CardContent className="grid gap-4 p-8">
            <h1 className="text-3xl font-bold tracking-normal">Public profile could not be loaded.</h1>
            <Link className={cn(buttonVariants({ variant: 'secondary' }), 'mx-auto rounded-xl shadow')} href="/discover">
              Back to discovery
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const experienceText =
    data.profile.experienceYears > 0
      ? `${data.profile.experienceYears} ${data.profile.experienceYears === 1 ? 'year' : 'years'}`
      : 'No experience added yet';
  const visibilityText = data.profile.visibility
    ? data.profile.visibility.charAt(0).toUpperCase() + data.profile.visibility.slice(1)
    : 'Private';

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <section className="mx-auto grid max-w-6xl gap-8">
      <BackButton />
      <Card className="rounded-3xl shadow-polish" aria-label={`${data.username} public profile`}>
        <CardHeader>
          <Badge className="mb-2 w-fit rounded-full shadow" variant="outline">
            <UserRound className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            @{data.username}
          </Badge>
          <CardTitle className="text-4xl">{data.profile.name || data.username}</CardTitle>
          <CardDescription className="max-w-3xl text-base">{data.profile.bio || 'No bio added yet'}</CardDescription>
        </CardHeader>
        <CardContent>
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <dt className="text-sm font-medium text-muted-foreground">Experience</dt>
            <dd className="mt-1 font-semibold">{experienceText}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
              Visibility
            </dt>
            <dd className="mt-1 font-semibold">{visibilityText}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Certifications
            </dt>
            <dd>
              {data.profile.certifications.length > 0 ? (
                <ul className="mt-2 grid gap-1">
                  {data.profile.certifications.map((certification) => (
                    <li key={certification}>{certification}</li>
                  ))}
                </ul>
              ) : (
                'No certifications added yet'
              )}
            </dd>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <LinkIcon className="h-4 w-4 text-primary" aria-hidden="true" />
              Links
            </dt>
            <dd>
              {data.profile.links.length > 0 ? (
                <ul className="mt-2 grid gap-1">
                  {data.profile.links.map((link) => (
                    <li key={link}>
                      <a href={link}>{link}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                'No links added yet'
              )}
            </dd>
          </div>
        </dl>
        </CardContent>
      </Card>

      <section className="grid gap-5" aria-label="Published projects">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge className="mb-3 w-fit rounded-full" variant="secondary">Portfolio</Badge>
            <h2 className="text-2xl font-bold tracking-normal">Published projects</h2>
          </div>
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" href="/discover">
            Explore more
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        {data.publishedProjects.length > 0 ? (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.publishedProjects.map((project) => (
              <li key={project.id}>
                <Card className="h-full rounded-2xl shadow transition hover:-translate-y-0.5 hover:shadow-polish">
                  <CardHeader>
                    <CardTitle>
                      <a href={`/project/${encodeURIComponent(project.slug)}`}>{project.title}</a>
                    </CardTitle>
                    <CardDescription>{project.summary || 'No summary added yet.'}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="rounded-2xl border-dashed shadow">
            <CardContent className="grid gap-4 p-6 text-center">
              <p className="font-medium">No published projects yet.</p>
              <Link className={cn(buttonVariants({ variant: 'secondary' }), 'mx-auto rounded-xl shadow')} href="/discover">
                Browse discovery
              </Link>
            </CardContent>
          </Card>
        )}
      </section>
      </section>
    </main>
  );
}
