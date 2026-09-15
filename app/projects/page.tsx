'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProjectEditor } from './ProjectEditor';
import { ProjectList, type ProjectSummary } from './ProjectList';

export default function ProjectsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectListStatus, setProjectListStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let isActive = true;

    async function loadProjects() {
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
    }

    loadProjects();

    return () => {
      isActive = false;
    };
  }, [status]);

  if (status === 'loading') {
    return <p>Checking your session...</p>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <main>
      <h1>Project management workspace</h1>
      <ProjectEditor onProjectCreated={(project) => setProjects((currentProjects) => [project, ...currentProjects])} />
      <ProjectList projects={projects} status={projectListStatus} />
    </main>
  );
}
