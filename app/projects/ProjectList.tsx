'use client';

import { useState } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';

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
    return <p>Loading projects...</p>;
  }

  if (status === 'error') {
    return <p>Projects could not be loaded.</p>;
  }

  const visibleProjects = projects.filter((project) => !deletedProjectIds.includes(project.id));

  if (visibleProjects.length === 0) {
    return <EmptyState message="No projects yet." />;
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
    <section className="responsive-section project-list" aria-label="Project list">
      <ul className="responsive-card-grid project-list-grid">
        {visibleProjects.map((project) => (
          <li className="responsive-card" key={project.id}>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <dl className="responsive-definition-grid">
              <div>
                <dt>Status</dt>
                <dd>{project.status}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{visibilityLabel(project.visibility)}</dd>
              </div>
            </dl>
            <div className="responsive-actions">
              {onEditProject ? (
                <Button variant="secondary" onClick={() => onEditProject(project)}>
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
                  Delete {project.title}
                </Button>
              ) : null}
              {onPublishProject && canPublishProject(project) ? (
                <Button onClick={() => onPublishProject(project.id)}>
                  Publish {project.title}
                </Button>
              ) : null}
              {onUnpublishProject && isPublishedProject(project) ? (
                <Button variant="secondary" onClick={() => onUnpublishProject(project.id)}>
                  Unpublish {project.title}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {deleteError ? <p role="alert">{deleteError}</p> : null}
      {projectToDelete ? (
        <div
          aria-labelledby="delete-project-title"
          aria-modal="true"
          role="dialog"
        >
          <h2 id="delete-project-title">Delete {projectToDelete.title}</h2>
          <p>This draft project will be permanently deleted.</p>
          <Button onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button variant="secondary" onClick={() => setProjectToDelete(null)} disabled={isDeleting}>
            Cancel
          </Button>
        </div>
      ) : null}
    </section>
  );
}
