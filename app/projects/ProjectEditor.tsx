'use client';

import { useState } from 'react';
import type { ProjectSummary } from './ProjectList';

type ProjectEditorProps = {
  onProjectCreated(project: ProjectSummary): void;
};

type FieldErrors = Partial<Record<'title' | 'summary' | 'role', string>>;

export function ProjectEditor({ onProjectCreated }: ProjectEditorProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [projectType, setProjectType] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('draft');
  const [tags, setTags] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [problem, setProblem] = useState('');
  const [features, setFeatures] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');
  const [contribution, setContribution] = useState('');
  const [outcome, setOutcome] = useState('');
  const [visibility, setVisibility] = useState('draft');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = 'Title is required.';
    if (!summary.trim()) errors.summary = 'Summary is required.';
    if (!role.trim()) errors.role = 'Role is required.';
    return errors;
  }

  function resetForm() {
    setTitle('');
    setSummary('');
    setProjectType('');
    setRole('');
    setStatus('draft');
    setTags('');
    setCoverImageUrl('');
    setProblem('');
    setFeatures('');
    setTechnicalNotes('');
    setContribution('');
    setOutcome('');
    setVisibility('draft');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          projectType,
          role,
          status,
          tags,
          coverImageUrl,
          problem,
          features,
          technicalNotes,
          contribution,
          outcome,
          visibility,
        }),
      });
      const data = await response.json();

      if (response.status === 400 || response.status === 422) {
        setFieldErrors((data.fields ?? {}) as FieldErrors);
        return;
      }

      if (response.status === 409) {
        setMessage('Choose a unique title or slug before saving.');
        return;
      }

      if (!response.ok) {
        setMessage('Project could not be created.');
        return;
      }

      onProjectCreated(data as ProjectSummary);
      setMessage('Project draft created.');
      setFieldErrors({});
      resetForm();
    } catch {
      setMessage('Project could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form aria-label="Project editor" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="project-title">Title</label>
        <input id="project-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        {fieldErrors.title ? <p>{fieldErrors.title}</p> : null}
      </div>
      <div>
        <label htmlFor="project-summary">Summary</label>
        <textarea id="project-summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
        {fieldErrors.summary ? <p>{fieldErrors.summary}</p> : null}
      </div>
      <div>
        <label htmlFor="project-role">Role</label>
        <input id="project-role" value={role} onChange={(event) => setRole(event.target.value)} />
        {fieldErrors.role ? <p>{fieldErrors.role}</p> : null}
      </div>
      <div>
        <label htmlFor="project-type">Project type</label>
        <input id="project-type" value={projectType} onChange={(event) => setProjectType(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-status">Status</label>
        <input id="project-status" value={status} onChange={(event) => setStatus(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-tags">Tags</label>
        <input id="project-tags" value={tags} onChange={(event) => setTags(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-cover">Cover image URL</label>
        <input id="project-cover" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-problem">Problem</label>
        <textarea id="project-problem" value={problem} onChange={(event) => setProblem(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-features">Features</label>
        <textarea id="project-features" value={features} onChange={(event) => setFeatures(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-technical-notes">Technical notes</label>
        <textarea id="project-technical-notes" value={technicalNotes} onChange={(event) => setTechnicalNotes(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-contribution">Contribution</label>
        <textarea id="project-contribution" value={contribution} onChange={(event) => setContribution(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-outcome">Outcome</label>
        <textarea id="project-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-visibility">Visibility</label>
        <select id="project-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
      </div>
      {message ? <p>{message}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create project'}
      </button>
    </form>
  );
}
