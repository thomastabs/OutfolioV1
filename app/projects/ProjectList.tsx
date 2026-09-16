'use client';

import { useState } from 'react';

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
    return <p>No projects yet.</p>;
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
    <section aria-label="Project list">
      <ul>
        {visibleProjects.map((project) => (
          <li key={project.id}>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{project.status}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{visibilityLabel(project.visibility)}</dd>
              </div>
            </dl>
            {onEditProject ? (
              <button type="button" onClick={() => onEditProject(project)}>
                Edit {project.title}
              </button>
            ) : null}
            {isDraftProject(project) ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setProjectToDelete(project);
                }}
              >
                Delete {project.title}
              </button>
            ) : null}
            {onPublishProject && canPublishProject(project) ? (
              <button type="button" onClick={() => onPublishProject(project.id)}>
                Publish {project.title}
              </button>
            ) : null}
            {onUnpublishProject && isPublishedProject(project) ? (
              <button type="button" onClick={() => onUnpublishProject(project.id)}>
                Unpublish {project.title}
              </button>
            ) : null}
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
          <button type="button" onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button type="button" onClick={() => setProjectToDelete(null)} disabled={isDeleting}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
}
