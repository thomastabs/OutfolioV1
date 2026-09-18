'use client';

import { useEffect, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { ValidationMessage } from '../components/ValidationMessage';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';

export type ProfileData = {
  userId: string;
  name: string;
  bio: string;
  experienceYears: number;
  certifications: string[];
  links: string[];
  visibility: string;
};

type ProfileEditorProps = {
  profile: ProfileData;
  onProfileSaved(profile: ProfileData): void;
};

type ValidationFields = Partial<Record<'experienceYears' | 'links' | 'certifications' | 'visibility' | 'name' | 'bio', string>>;
const visibilityOptions = ['public', 'private', 'unlisted'];

function listToText(values: string[]) {
  return values.join('\n');
}

function textToList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ProfileEditor({ profile, onProfileSaved }: ProfileEditorProps) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [experienceYears, setExperienceYears] = useState(String(profile.experienceYears));
  const [certifications, setCertifications] = useState(listToText(profile.certifications));
  const [links, setLinks] = useState(listToText(profile.links));
  const [visibility, setVisibility] = useState(profile.visibility);
  const [fieldErrors, setFieldErrors] = useState<ValidationFields>({});
  const [generalMessage, setGeneralMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setBio(profile.bio);
    setExperienceYears(String(profile.experienceYears));
    setCertifications(listToText(profile.certifications));
    setLinks(listToText(profile.links));
    setVisibility(profile.visibility);
  }, [profile]);

  function validateClientSide() {
    const errors: ValidationFields = {};
    const years = Number(experienceYears);
    const parsedLinks = textToList(links);

    if (!name.trim()) {
      errors.name = 'Name is required.';
    }

    if (!Number.isInteger(years) || years < 0) {
      errors.experienceYears = 'Years of experience must be a non-negative integer.';
    }

    if (parsedLinks.some((link) => !isHttpUrl(link))) {
      errors.links = 'Links must be valid HTTP or HTTPS URLs.';
    }

    if (!visibilityOptions.includes(visibility)) {
      errors.visibility = 'Visibility must be public, private, or unlisted.';
    }

    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralMessage('');

    const clientErrors = validateClientSide();
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/v1/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bio,
          experienceYears: Number(experienceYears),
          certifications: textToList(certifications),
          links: textToList(links),
          visibility,
        }),
      });

      const data = await response.json();

      if (response.status === 422) {
        setFieldErrors((data.fields ?? {}) as ValidationFields);
        setGeneralMessage('');
        return;
      }

      if (!response.ok) {
        setGeneralMessage('Could not save profile changes.');
        return;
      }

      const savedProfile = data as ProfileData;
      setFieldErrors({});
      setGeneralMessage('Profile saved.');
      onProfileSaved(savedProfile);
    } catch {
      setGeneralMessage('Could not save profile changes.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-5 md:grid-cols-2" aria-label="Profile editor" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="profile-name">Name</label>
        <Input
          id="profile-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={fieldErrors.name ? 'true' : undefined}
          aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
        />
        {fieldErrors.name ? <ValidationMessage id="profile-name-error" message={fieldErrors.name} /> : null}
      </div>

      <div className="grid gap-2 md:col-span-2">
        <label className="text-sm font-semibold" htmlFor="profile-bio">Bio</label>
        <Textarea id="profile-bio" name="bio" value={bio} onChange={(event) => setBio(event.target.value)} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="profile-experience">Years of experience</label>
        <Input
          id="profile-experience"
          name="experienceYears"
          type="number"
          min="0"
          value={experienceYears}
          onChange={(event) => setExperienceYears(event.target.value)}
          aria-invalid={fieldErrors.experienceYears ? 'true' : undefined}
          aria-describedby={fieldErrors.experienceYears ? 'profile-experience-error' : undefined}
        />
        {fieldErrors.experienceYears ? (
          <ValidationMessage id="profile-experience-error" message={fieldErrors.experienceYears} />
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="profile-certifications">Certifications</label>
        <Textarea
          id="profile-certifications"
          name="certifications"
          value={certifications}
          onChange={(event) => setCertifications(event.target.value)}
          aria-invalid={fieldErrors.certifications ? 'true' : undefined}
          aria-describedby={fieldErrors.certifications ? 'profile-certifications-error' : undefined}
        />
        {fieldErrors.certifications ? (
          <ValidationMessage id="profile-certifications-error" message={fieldErrors.certifications} />
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="profile-links">Public links</label>
        <Textarea
          id="profile-links"
          name="links"
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          aria-invalid={fieldErrors.links ? 'true' : undefined}
          aria-describedby={fieldErrors.links ? 'profile-links-error' : undefined}
        />
        {fieldErrors.links ? <ValidationMessage id="profile-links-error" message={fieldErrors.links} /> : null}
      </div>

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="profile-visibility">
          <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
          Visibility
        </label>
        <select
          id="profile-visibility"
          className="h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
          name="visibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          aria-invalid={fieldErrors.visibility ? 'true' : undefined}
          aria-describedby={fieldErrors.visibility ? 'profile-visibility-error' : undefined}
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
        </select>
        {fieldErrors.visibility ? (
          <ValidationMessage id="profile-visibility-error" message={fieldErrors.visibility} />
        ) : null}
      </div>

      {generalMessage ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 md:col-span-2" role="status" aria-live="polite">
          {generalMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-muted-foreground md:col-span-2">
      <Button type="submit" disabled={isSaving}>
        <Save className="h-4 w-4" aria-hidden="true" />
        {isSaving ? 'Saving...' : 'Save profile'}
      </Button>
      <Badge className="rounded-full" variant="outline">Current: {visibility}</Badge>
      </div>
    </form>
  );
}
