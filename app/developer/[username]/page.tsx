'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    return <p>Loading profile...</p>;
  }

  if (state === 'unavailable') {
    return (
      <main className="page-shell public-profile-page">
        <h1>Profile is unavailable.</h1>
      </main>
    );
  }

  if (state === 'error' || !data) {
    return (
      <main className="page-shell public-profile-page">
        <h1>Public profile could not be loaded.</h1>
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
    <main className="page-shell public-profile-page">
      <section className="responsive-section public-profile-summary" aria-label={`${data.username} public profile`}>
        <h1>{data.profile.name || data.username}</h1>
        <dl className="responsive-definition-grid">
          <div>
            <dt>Bio</dt>
            <dd>{data.profile.bio || 'No bio added yet'}</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{experienceText}</dd>
          </div>
          <div>
            <dt>Visibility</dt>
            <dd>{visibilityText}</dd>
          </div>
          <div>
            <dt>Certifications</dt>
            <dd>
              {data.profile.certifications.length > 0 ? (
                <ul>
                  {data.profile.certifications.map((certification) => (
                    <li key={certification}>{certification}</li>
                  ))}
                </ul>
              ) : (
                'No certifications added yet'
              )}
            </dd>
          </div>
          <div>
            <dt>Links</dt>
            <dd>
              {data.profile.links.length > 0 ? (
                <ul>
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
      </section>

      <section className="responsive-section" aria-label="Published projects">
        <h2>Published projects</h2>
        {data.publishedProjects.length > 0 ? (
          <ul className="responsive-card-grid">
            {data.publishedProjects.map((project) => (
              <li className="responsive-card" key={project.id}>
                <h3>
                  <a href={`/project/${encodeURIComponent(project.slug)}`}>{project.title}</a>
                </h3>
                <p>{project.summary || 'No summary added yet.'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No published projects yet.</p>
        )}
      </section>
    </main>
  );
}
