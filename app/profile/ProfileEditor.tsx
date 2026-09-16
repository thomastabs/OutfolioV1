'use client';

import { useEffect, useState } from 'react';

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
    <form aria-label="Profile editor" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="profile-name">Name</label>
        <input
          id="profile-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={fieldErrors.name ? 'true' : undefined}
          aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
        />
        {fieldErrors.name ? <p id="profile-name-error">{fieldErrors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-bio">Bio</label>
        <textarea id="profile-bio" name="bio" value={bio} onChange={(event) => setBio(event.target.value)} />
      </div>

      <div>
        <label htmlFor="profile-experience">Years of experience</label>
        <input
          id="profile-experience"
          name="experienceYears"
          type="number"
          min="0"
          value={experienceYears}
          onChange={(event) => setExperienceYears(event.target.value)}
          aria-describedby={fieldErrors.experienceYears ? 'profile-experience-error' : undefined}
        />
        {fieldErrors.experienceYears ? <p id="profile-experience-error">{fieldErrors.experienceYears}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-certifications">Certifications</label>
        <textarea
          id="profile-certifications"
          name="certifications"
          value={certifications}
          onChange={(event) => setCertifications(event.target.value)}
          aria-describedby={fieldErrors.certifications ? 'profile-certifications-error' : undefined}
        />
        {fieldErrors.certifications ? <p id="profile-certifications-error">{fieldErrors.certifications}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-links">Public links</label>
        <textarea
          id="profile-links"
          name="links"
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          aria-describedby={fieldErrors.links ? 'profile-links-error' : undefined}
        />
        {fieldErrors.links ? <p id="profile-links-error">{fieldErrors.links}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-visibility">Visibility</label>
        <select id="profile-visibility" name="visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="private">Private</option>
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
        </select>
        {fieldErrors.visibility ? <p>{fieldErrors.visibility}</p> : null}
      </div>

      {generalMessage ? <p>{generalMessage}</p> : null}

      <button type="submit" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save profile'}
      </button>
    </form>
  );
}
