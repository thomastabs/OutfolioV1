'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../../session-context';
import { BackButton } from '@/app/components/ui/back-button';
import { ProjectEditor, type ProjectData } from '../ProjectEditor';

type ProjectEditPageProps = {
  params: {
    id: string;
  };
};

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

export default function ProjectEditPage({ params }: ProjectEditPageProps) {
  const router = useRouter();
  const { status } = useSession();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let isActive = true;

    async function loadProject() {
      setLoadState('loading');

      try {
        const response = await fetch(`/api/v1/projects/${encodeURIComponent(params.id)}`);
        if (!isActive) return;

        if (response.status === 403 || response.status === 404) {
          setLoadState('unavailable');
          return;
        }

        if (!response.ok) {
          setLoadState('error');
          return;
        }

        const data = (await response.json()) as ProjectData;
        setProject(data);
        setLoadState('ready');
      } catch {
        if (isActive) {
          setLoadState('error');
        }
      }
    }

    loadProject();

    return () => {
      isActive = false;
    };
  }, [params.id, status]);

  if (status === 'loading') {
    return <p>Checking your session...</p>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (loadState === 'loading') {
    return <p>Loading project...</p>;
  }

  if (loadState === 'unavailable') {
    return (
      <main className="page-shell project-edit-page">
        <BackButton />
        <p>Project is unavailable.</p>
      </main>
    );
  }

  if (loadState === 'error' || !project) {
    return (
      <main className="page-shell project-edit-page">
        <BackButton />
        <p>Project could not be loaded.</p>
      </main>
    );
  }

  return (
    <main className="page-shell project-edit-page">
      <BackButton />
      <h1>Edit project</h1>
      <ProjectEditor
        project={project}
        onProjectUpdated={(updatedProject) => {
          setProject(updatedProject);
          setMessage('Project saved.');
        }}
      />
      {message ? <p>{message}</p> : null}
    </main>
  );
}
