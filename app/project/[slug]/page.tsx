'use client';

import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Images, Lock, Tag, UserRound } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackButton } from '@/app/components/ui/back-button';
import { Badge } from '@/app/components/ui/badge';
import { buttonVariants } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { cn } from '@/src/lib/utils';

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

type PublicProjectImage = {
  id: string;
  url: string;
  order: number;
};

type ImageLoadState = 'idle' | 'loading' | 'ready' | 'error';
type LoadState = 'loading' | 'ready' | 'access-denied' | 'not-found' | 'error';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value || 'Not added yet.'}</dd>
    </div>
  );
}

function ProjectStateCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <BackButton className="mx-auto mb-6" />
      <Card className="mx-auto max-w-3xl rounded-3xl text-center shadow-polish">
        <CardContent className="grid gap-4 p-8">
          <Lock className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold tracking-normal">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
          <Link className={cn(buttonVariants({ variant: 'secondary' }), 'mx-auto rounded-xl shadow')} href="/discover">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to discovery
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export default function PublicProjectPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [state, setState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject | null>(null);
  const [images, setImages] = useState<PublicProjectImage[]>([]);
  const [imageState, setImageState] = useState<ImageLoadState>('idle');

  useEffect(() => {
    let isActive = true;

    async function loadProject() {
      setState('loading');
      setProject(null);
      setImages([]);
      setImageState('idle');

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
        setImageState('loading');

        try {
          const imagesResponse = await fetch(`/api/v1/public/project/${encodeURIComponent(slug)}/images`);
          if (!isActive) return;

          if (!imagesResponse.ok) {
            setImageState('error');
            return;
          }

          const imageData = (await imagesResponse.json()) as { images?: PublicProjectImage[] };
          setImages(Array.isArray(imageData.images) ? imageData.images : []);
          setImageState('ready');
        } catch {
          if (isActive) {
            setImageState('error');
          }
        }
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
    return <p className="p-8 text-sm font-medium text-muted-foreground">Loading project...</p>;
  }

  if (state === 'access-denied') {
    return <ProjectStateCard title="Access denied" message="This project is unpublished or private." />;
  }

  if (state === 'not-found') {
    return <ProjectStateCard title="Project not found" message="This project does not exist or is unavailable." />;
  }

  if (state === 'error' || !project) {
    return <ProjectStateCard title="Project unavailable" message="The project could not be loaded." />;
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <article className="mx-auto grid max-w-6xl gap-8" aria-label={`${project.title} public project`}>
        <BackButton />
        <Card className="rounded-3xl shadow-polish">
          <CardHeader>
            <Badge className="mb-2 w-fit rounded-full shadow" variant="outline">
              <UserRound className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {project.owner.name || project.owner.username}
            </Badge>
            <CardTitle className="text-4xl">{project.title}</CardTitle>
            <CardDescription className="max-w-3xl text-base">{project.summary || 'No summary added yet.'}</CardDescription>
          </CardHeader>
        </Card>

        {project.coverImageUrl ? (
          <img className="rounded-3xl border border-border shadow-polish" src={project.coverImageUrl} alt={`${project.title} cover image`} />
        ) : (
          <Card className="rounded-2xl border-dashed shadow">
            <CardContent className="p-6 text-center text-muted-foreground">No cover image added yet.</CardContent>
          </Card>
        )}

        <dl className="grid gap-4 md:grid-cols-3">
          <Field label="Project type" value={project.projectType} />
          <Field label="Role" value={project.role} />
          <Field label="Status" value={project.status} />
        </dl>

        <Card className="rounded-2xl shadow" aria-label="Project image gallery">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Images className="h-5 w-5 text-primary" aria-hidden="true" />
              Project gallery
            </CardTitle>
            <CardDescription>Published screenshots and project visuals shown in their saved order.</CardDescription>
          </CardHeader>
          <CardContent>
            {imageState === 'loading' ? (
              <p className="text-muted-foreground">Loading project images...</p>
            ) : null}
            {imageState === 'error' ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="status">
                Project images could not be loaded.
              </p>
            ) : null}
            {imageState === 'ready' && images.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                No project images are available yet.
              </p>
            ) : null}
            {images.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image, index) => (
                  <figure className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm" key={image.id}>
                    <div className="aspect-video bg-muted">
                      <img
                        src={image.url}
                        alt={`${project.title} gallery image ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <figcaption className="px-3 py-2 text-sm font-medium text-muted-foreground">
                      Image {index + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow" aria-label="Project tags">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" aria-hidden="true" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
          {project.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <li key={tag}>
                  <Badge className="rounded-full" variant="secondary">{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No tags added yet.</p>
          )}
          </CardContent>
        </Card>

        {[
          ['Problem', project.problem],
          ['Features', project.features],
          ['Technical notes', project.technicalNotes],
          ['Contribution', project.contribution],
          ['Outcome', project.outcome],
        ].map(([label, value]) => (
          <Card className="rounded-2xl shadow" key={label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">{value || 'Not added yet.'}</p>
            </CardContent>
          </Card>
        ))}

        <Link className={cn(buttonVariants({ variant: 'secondary' }), 'w-fit rounded-xl shadow')} href="/discover">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to discovery
        </Link>
      </article>
    </main>
  );
}
