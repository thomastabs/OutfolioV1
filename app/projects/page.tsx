'use client';

import { useCallback, useEffect } from 'react';
import { useState } from 'react';
import { FolderKanban, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from '../session-context';
import { BackButton } from '@/app/components/ui/back-button';
import { ValidationMessage } from '../components/ValidationMessage';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
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
    return <p className="p-8 text-sm font-medium text-muted-foreground">Checking your session...</p>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <section className="mx-auto grid max-w-7xl gap-8">
        <BackButton />
        <header className="rounded-3xl border border-border bg-card p-8 shadow-polish">
          <Badge className="mb-4 w-fit rounded-full shadow" variant="outline">
            <FolderKanban className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Project workspace
          </Badge>
          <h1 className="text-4xl font-bold tracking-normal text-foreground">Project management workspace</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Create drafts, polish case studies, and publish the work you want visitors to discover.
          </p>
        </header>
      <div aria-live="polite" className="sr-only">
        {projectListStatus === 'ready' ? `${projects.length} projects loaded.` : projectListStatus}
      </div>
      {workspaceError ? <ValidationMessage message={workspaceError} /> : null}
      <h2 id="project-editor-heading" className="visually-hidden">Project editor</h2>
      <Card className="rounded-3xl shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            {editingProject ? 'Edit project case study' : 'Create a project draft'}
          </CardTitle>
          <CardDescription>Capture the visible result, implementation role, and outcome of the work.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
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
      </section>
    </main>
  );
}
