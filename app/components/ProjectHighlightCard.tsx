'use client';

import Link from 'next/link';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/src/lib/utils';
import { Badge } from './ui/badge';
import { buttonVariants } from './ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

export type ProjectHighlight = {
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

type ProjectHighlightCardProps = {
  project: ProjectHighlight;
};

function canViewPublicProject(project: ProjectHighlight) {
  return project.visibility === 'PUBLISHED' && Boolean(project.slug?.trim());
}

function ProjectHighlightCover({ project }: ProjectHighlightCardProps) {
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

function ProjectHighlightMetadata({ project }: ProjectHighlightCardProps) {
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

export function ProjectHighlightCard({ project }: ProjectHighlightCardProps) {
  return (
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
  );
}
