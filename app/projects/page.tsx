'use client';

import { useCallback, useEffect } from 'react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ValidationMessage } from '../components/ValidationMessage';
import { ProjectEditor, type ProjectData } from './ProjectEditor';
import { ProjectList, type ProjectSummary } from './ProjectList';

export default function ProjectsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectListStatus, setProjectListStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');

  const loadProjects = useCallback(async (isActive = true) => {
    setProjectListStatus('loading');

    try {
      const response = await fetch('/api/v1/projects');
      if (!isActive) return;

      if (!response.ok) {
        setProjectListStatus('error');
        return;
      }

      const data = (await response.json()) as { projects: ProjectSummary[] };
      setProjects(data.projects);
      setProjectListStatus('ready');
    } catch {
      if (isActive) {
        setProjectListStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let isActive = true;

    loadProjects(isActive);

    return () => {
      isActive = false;
    };
  }, [loadProjects, status]);

  async function changeProjectVisibility(projectId: string, action: 'publish' | 'unpublish') {
    setWorkspaceError('');

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/${action}`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setWorkspaceError(
          typeof data.message === 'string'
            ? data.message
            : action === 'publish'
              ? 'Project could not be published.'
              : 'Project could not be unpublished.',
        );
        return;
      }

      await loadProjects();
    } catch {
      setWorkspaceError(action === 'publish' ? 'Project could not be published.' : 'Project could not be unpublished.');
    }
  }

  if (status === 'loading') {
    return <p>Checking your session...</p>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <main className="page-shell projects-page">
      <h1>Project management workspace</h1>
      {workspaceError ? <ValidationMessage message={workspaceError} /> : null}
      <h2 id="project-editor-heading" className="visually-hidden">Project editor</h2>
      {editingProject ? (
        <ProjectEditor
          project={editingProject}
          onProjectUpdated={async () => {
            setEditingProject(null);
            await loadProjects();
          }}
        />
      ) : (
        <ProjectEditor onProjectCreated={(project) => setProjects((currentProjects) => [project, ...currentProjects])} />
      )}
      <h2 id="project-list-heading" className="visually-hidden">Project list</h2>
      <ProjectList
        projects={projects}
        status={projectListStatus}
        onEditProject={(project) => setEditingProject(project)}
        onProjectDeleted={(projectId) => {
          setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId));
          if (editingProject?.id === projectId) {
            setEditingProject(null);
          }
        }}
        onPublishProject={(projectId) => changeProjectVisibility(projectId, 'publish')}
        onUnpublishProject={(projectId) => changeProjectVisibility(projectId, 'unpublish')}
      />
    </main>
  );
}
