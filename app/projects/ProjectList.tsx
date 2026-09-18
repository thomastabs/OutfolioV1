'use client';

import { useState } from 'react';
import { AlertTriangle, Edit3, EyeOff, Send, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';

export type ProjectSummary = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  projectType?: string;
  role: string;
  status: string;
  tags?: string[];
  coverImageUrl?: string;
  problem?: string;
  features?: string;
  technicalNotes?: string;
  contribution?: string;
  outcome?: string;
  visibility: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProjectListProps = {
  projects: ProjectSummary[];
  status: 'loading' | 'ready' | 'error';
  onEditProject?(project: ProjectSummary): void;
  onProjectDeleted?(projectId: string): void;
  onPublishProject?(projectId: string): void;
  onUnpublishProject?(projectId: string): void;
};

function visibilityLabel(visibility: string) {
  return visibility.charAt(0).toUpperCase() + visibility.slice(1);
}

function visibilityIndicatorClass(visibility: string) {
  return `state-indicator state-indicator--${visibility.toLowerCase()}`;
}

function isDraftProject(project: ProjectSummary) {
  return project.visibility.toLowerCase() === 'draft';
}

function isPublishedProject(project: ProjectSummary) {
  return project.visibility.toLowerCase() === 'published';
}

function canPublishProject(project: ProjectSummary) {
  return ['draft', 'unpublished'].includes(project.visibility.toLowerCase());
}

export function ProjectList({
  projects,
  status,
  onEditProject,
  onProjectDeleted,
  onPublishProject,
  onUnpublishProject,
}: ProjectListProps) {
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null);
  const [deletedProjectIds, setDeletedProjectIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (status === 'loading') {
    return <p className="rounded-2xl border border-border bg-card p-6 text-sm font-medium text-muted-foreground shadow">Loading projects...</p>;
  }

  if (status === 'error') {
    return (
      <Card className="rounded-2xl border-destructive/30 shadow">
        <CardContent className="flex items-center gap-3 p-6 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <p>Projects could not be loaded.</p>
        </CardContent>
      </Card>
    );
  }

  const visibleProjects = projects.filter((project) => !deletedProjectIds.includes(project.id));

  if (visibleProjects.length === 0) {
    return <EmptyState message="No projects yet. Create a draft case study to start shaping your portfolio." />;
  }

  async function confirmDelete() {
    if (!projectToDelete) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(`/api/v1/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDeleteError(
          typeof data.message === 'string'
            ? data.message
            : 'Project could not be deleted.',
        );
        return;
      }

      setDeletedProjectIds((currentIds) => [...currentIds, projectToDelete.id]);
      onProjectDeleted?.(projectToDelete.id);
      setProjectToDelete(null);
    } catch {
      setDeleteError('Project could not be deleted.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="grid gap-5 rounded-3xl border border-border bg-card p-6 shadow" aria-label="Project list">
      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleProjects.map((project) => (
          <li key={project.id}>
            <Card className="h-full rounded-2xl shadow transition hover:-translate-y-0.5 hover:shadow-polish">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{project.title}</CardTitle>
                  <Badge className={visibilityIndicatorClass(project.visibility)} variant="outline">
                    {visibilityLabel(project.visibility)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{project.summary}</p>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-muted-foreground">Status</dt>
                    <dd>{project.status}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Role</dt>
                    <dd>{project.role}</dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter className="gap-2">
              {onEditProject ? (
                <Button variant="secondary" onClick={() => onEditProject(project)}>
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  Edit {project.title}
                </Button>
              ) : null}
              {isDraftProject(project) ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDeleteError('');
                    setProjectToDelete(project);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete {project.title}
                </Button>
              ) : null}
              {onPublishProject && canPublishProject(project) ? (
                <Button onClick={() => onPublishProject(project.id)}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Publish {project.title}
                </Button>
              ) : null}
              {onUnpublishProject && isPublishedProject(project) ? (
                <Button variant="secondary" onClick={() => onUnpublishProject(project.id)}>
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  Unpublish {project.title}
                </Button>
              ) : null}
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>
      {deleteError ? <p className="text-sm font-medium text-destructive" role="alert">{deleteError}</p> : null}
      {projectToDelete ? (
        <div
          aria-labelledby="delete-project-title"
          aria-modal="true"
          className="grid gap-4 rounded-2xl border border-destructive/30 bg-card p-6 shadow"
          role="dialog"
        >
          <h2 className="text-xl font-bold" id="delete-project-title">Delete {projectToDelete.title}</h2>
          <p className="text-sm text-muted-foreground">This draft project will be permanently deleted.</p>
          <div className="flex flex-wrap gap-3">
          <Button onClick={confirmDelete} disabled={isDeleting} variant="destructive">
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button variant="secondary" onClick={() => setProjectToDelete(null)} disabled={isDeleting}>
            Cancel
          </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
