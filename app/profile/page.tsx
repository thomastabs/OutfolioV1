'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Link as LinkIcon, Shield, UserRound } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
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
    return <p className="p-8 text-sm font-medium text-muted-foreground">Checking your session...</p>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <section className="mx-auto grid max-w-6xl gap-8">
        <header className="rounded-3xl border border-border bg-card p-8 shadow-polish">
          <Badge className="mb-4 w-fit rounded-full shadow" variant="outline">
            <UserRound className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Developer profile
          </Badge>
          <h1 className="text-4xl font-bold tracking-normal text-foreground">Profile workspace</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Shape the public developer profile that anchors your project case studies.
          </p>
        </header>
      {profileStatus === 'loading' ? <p className="rounded-2xl border border-border bg-card p-6 text-sm font-medium text-muted-foreground shadow">Loading profile...</p> : null}
      {profileStatus === 'not_found' ? (
        <Card className="rounded-2xl border-dashed shadow">
          <CardContent className="grid gap-3 p-6 text-center">
            <UserRound className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <p className="font-medium">No profile has been created yet.</p>
            <p className="text-sm text-muted-foreground">Create your developer profile to make public portfolio pages feel complete.</p>
          </CardContent>
        </Card>
      ) : null}
      {profileStatus === 'error' ? <p className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm font-medium text-destructive shadow">Profile information is unavailable right now.</p> : null}
      {profile ? (
        <>
          <ProfileDetails profile={profile} />
          <Card className="rounded-3xl shadow">
            <CardHeader>
              <CardTitle>Edit profile details</CardTitle>
              <CardDescription>Keep your public story clear, current, and easy to scan.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileEditor profile={profile} onProfileSaved={setProfile} />
            </CardContent>
          </Card>
        </>
      ) : null}
      </section>
    </main>
  );
}

function ProfileDetails({ profile }: { profile: ProfileData }) {
  const experienceText = profile.experienceYears > 0 ? `${profile.experienceYears} ${profile.experienceYears === 1 ? 'year' : 'years'}` : 'No experience added yet';
  const visibilityText = profile.visibility.charAt(0).toUpperCase() + profile.visibility.slice(1);
  const visibilityClass = profile.visibility === 'public' ? 'published' : profile.visibility;

  return (
    <Card className="rounded-3xl shadow" aria-label="Developer profile" role="region">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{profile.name || 'No name added yet'}</CardTitle>
          <Badge className={`state-indicator state-indicator--${visibilityClass}`} variant="outline">
            <Shield className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {visibilityText}
          </Badge>
        </div>
        <CardDescription>{profile.bio || 'No bio added yet'}</CardDescription>
      </CardHeader>
      <CardContent>
      <dl className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <dt className="text-sm font-medium text-muted-foreground">Experience</dt>
          <dd className="mt-1 font-semibold">{experienceText}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Certifications
          </dt>
          <dd>
            {profile.certifications.length > 0 ? (
              <ul className="mt-2 grid gap-1">
                {profile.certifications.map((certification) => (
                  <li key={certification}>{certification}</li>
                ))}
              </ul>
            ) : (
              'No certifications added yet'
            )}
          </dd>
        </div>
        <div className="rounded-2xl border border-border bg-muted/40 p-4 md:col-span-2">
          <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LinkIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            Links
          </dt>
          <dd>
            {profile.links.length > 0 ? (
              <ul className="mt-2 grid gap-1">
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
      </CardContent>
    </Card>
  );
}
