'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProfileEditor, type ProfileData } from './ProfileEditor';

export default function ProfilePage() {
  const { replace } = useRouter();
  const { status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'not_found' | 'error'>('idle');

  useEffect(() => {
    if (status === 'unauthenticated') {
      replace('/login');
    }
  }, [replace, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let isActive = true;

    async function loadProfile() {
      setProfileStatus('loading');

      try {
        const response = await fetch('/api/v1/profile/me');

        if (!isActive) return;

        if (response.status === 401) {
          replace('/login');
          return;
        }

        if (response.status === 404) {
          setProfile(null);
          setProfileStatus('not_found');
          return;
        }

        if (!response.ok) {
          setProfile(null);
          setProfileStatus('error');
          return;
        }

        const data = (await response.json()) as ProfileData;
        setProfile(data);
        setProfileStatus('idle');
      } catch {
        if (isActive) {
          setProfile(null);
          setProfileStatus('error');
        }
      }
    }

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [replace, status]);

  if (status === 'loading') {
    return <p>Checking your session...</p>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <main className="page-shell profile-page">
      <h1>Profile workspace</h1>
      {profileStatus === 'loading' ? <p>Loading profile...</p> : null}
      {profileStatus === 'not_found' ? <p>No profile has been created yet.</p> : null}
      {profileStatus === 'error' ? <p>Profile information is unavailable right now.</p> : null}
      {profile ? (
        <>
          <ProfileDetails profile={profile} />
          <ProfileEditor profile={profile} onProfileSaved={setProfile} />
        </>
      ) : null}
    </main>
  );
}

function ProfileDetails({ profile }: { profile: ProfileData }) {
  const experienceText = profile.experienceYears > 0 ? `${profile.experienceYears} ${profile.experienceYears === 1 ? 'year' : 'years'}` : 'No experience added yet';
  const visibilityText = profile.visibility.charAt(0).toUpperCase() + profile.visibility.slice(1);
  const visibilityClass = profile.visibility === 'public' ? 'published' : profile.visibility;

  return (
    <section className="responsive-section profile-summary" aria-label="Developer profile">
      <h2>{profile.name || 'No name added yet'}</h2>
      <dl className="responsive-definition-grid">
        <div>
          <dt>Bio</dt>
          <dd>{profile.bio || 'No bio added yet'}</dd>
        </div>
        <div>
          <dt>Experience</dt>
          <dd>{experienceText}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>
            <span className={`state-indicator state-indicator--${visibilityClass}`}>
              {visibilityText}
            </span>
          </dd>
        </div>
        <div>
          <dt>Certifications</dt>
          <dd>
            {profile.certifications.length > 0 ? (
              <ul>
                {profile.certifications.map((certification) => (
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
            {profile.links.length > 0 ? (
              <ul>
                {profile.links.map((link) => (
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
  );
}
