'use client';

import { useEffect, useState } from 'react';
import { ValidationMessage } from '../components/ValidationMessage';
import type { ProjectSummary } from './ProjectList';

export type ProjectData = ProjectSummary & {
  projectType?: string;
  tags?: string[];
  coverImageUrl?: string;
  problem?: string;
  features?: string;
  technicalNotes?: string;
  contribution?: string;
  outcome?: string;
  publishedAt?: string | null;
};

type ProjectEditorProps = {
  project?: ProjectData;
  onProjectCreated?(project: ProjectSummary): void;
  onProjectUpdated?(project: ProjectData): void;
};

type FieldErrors = Partial<Record<
  | 'title'
  | 'summary'
  | 'role'
  | 'status'
  | 'tags'
  | 'coverImageUrl'
  | 'visibility'
  | 'publishedAt',
  string
>>;

function initialState(project?: ProjectData) {
  return {
    title: project?.title ?? '',
    summary: project?.summary ?? '',
    projectType: project?.projectType ?? '',
    role: project?.role ?? '',
    status: project?.status ?? 'draft',
    tags: project?.tags?.join(', ') ?? '',
    coverImageUrl: project?.coverImageUrl ?? '',
    problem: project?.problem ?? '',
    features: project?.features ?? '',
    technicalNotes: project?.technicalNotes ?? '',
    contribution: project?.contribution ?? '',
    outcome: project?.outcome ?? '',
    visibility: project?.visibility ?? 'draft',
  };
}

function tagsFromInput(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function isHttpUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ProjectEditor({ project, onProjectCreated, onProjectUpdated }: ProjectEditorProps) {
  const isEditMode = Boolean(project);
  const [title, setTitle] = useState(() => initialState(project).title);
  const [summary, setSummary] = useState(() => initialState(project).summary);
  const [projectType, setProjectType] = useState(() => initialState(project).projectType);
  const [role, setRole] = useState(() => initialState(project).role);
  const [status, setStatus] = useState(() => initialState(project).status);
  const [tags, setTags] = useState(() => initialState(project).tags);
  const [coverImageUrl, setCoverImageUrl] = useState(() => initialState(project).coverImageUrl);
  const [problem, setProblem] = useState(() => initialState(project).problem);
  const [features, setFeatures] = useState(() => initialState(project).features);
  const [technicalNotes, setTechnicalNotes] = useState(() => initialState(project).technicalNotes);
  const [contribution, setContribution] = useState(() => initialState(project).contribution);
  const [outcome, setOutcome] = useState(() => initialState(project).outcome);
  const [visibility, setVisibility] = useState(() => initialState(project).visibility);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibilityAction, setVisibilityAction] = useState<'publish' | 'unpublish' | null>(null);

  useEffect(() => {
    const nextState = initialState(project);
    setTitle(nextState.title);
    setSummary(nextState.summary);
    setProjectType(nextState.projectType);
    setRole(nextState.role);
    setStatus(nextState.status);
    setTags(nextState.tags);
    setCoverImageUrl(nextState.coverImageUrl);
    setProblem(nextState.problem);
    setFeatures(nextState.features);
    setTechnicalNotes(nextState.technicalNotes);
    setContribution(nextState.contribution);
    setOutcome(nextState.outcome);
    setVisibility(nextState.visibility);
    setFieldErrors({});
    setMessage('');
  }, [project]);

  function validate() {
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = 'Title is required.';
    if (!summary.trim()) errors.summary = 'Summary is required.';
    if (!role.trim()) errors.role = 'Role is required.';
    if (!status.trim()) errors.status = 'Status is required.';
    if (!visibility.trim()) errors.visibility = 'Visibility is required.';
    if (!isHttpUrl(coverImageUrl)) errors.coverImageUrl = 'Cover image URL must be an HTTP or HTTPS URL.';
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

  function requestBody() {
    return {
      title,
      summary,
      projectType,
      role,
      status,
      tags: tagsFromInput(tags),
      coverImageUrl,
      problem,
      features,
      technicalNotes,
      contribution,
      outcome,
      visibility,
      publishedAt: project?.publishedAt ?? null,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(isEditMode ? `/api/v1/projects/${project?.id}` : '/api/v1/projects', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody()),
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
        setMessage(isEditMode ? 'Project could not be saved.' : 'Project could not be created.');
        return;
      }

      if (isEditMode) {
        onProjectUpdated?.(data as ProjectData);
      } else {
        onProjectCreated?.(data as ProjectSummary);
      }
      setMessage(isEditMode ? 'Project saved.' : 'Project draft created.');
      setFieldErrors({});
      if (!isEditMode) resetForm();
    } catch {
      setMessage(isEditMode ? 'Project could not be saved.' : 'Project could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVisibilityAction(action: 'publish' | 'unpublish') {
    if (!project) return;

    setMessage('');
    setFieldErrors({});
    setVisibilityAction(action);

    try {
      const response = await fetch(`/api/v1/projects/${project.id}/${action}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (response.status === 422) {
        setFieldErrors((data.fields ?? {}) as FieldErrors);
        return;
      }

      if (!response.ok) {
        setMessage(action === 'publish' ? 'Project could not be published.' : 'Project could not be unpublished.');
        return;
      }

      const updatedProject = data as ProjectData;
      setVisibility(updatedProject.visibility);
      onProjectUpdated?.(updatedProject);
      setMessage(action === 'publish' ? 'Project published.' : 'Project unpublished.');
    } catch {
      setMessage(action === 'publish' ? 'Project could not be published.' : 'Project could not be unpublished.');
    } finally {
      setVisibilityAction(null);
    }
  }

  return (
    <form className="responsive-form project-editor-form" aria-label="Project editor" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="project-title">Title</label>
        <input
          id="project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={fieldErrors.title ? 'true' : undefined}
          aria-describedby={fieldErrors.title ? 'project-title-error' : undefined}
        />
        {fieldErrors.title ? <ValidationMessage id="project-title-error" message={fieldErrors.title} /> : null}
      </div>
      <div>
        <label htmlFor="project-summary">Summary</label>
        <textarea
          id="project-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          aria-invalid={fieldErrors.summary ? 'true' : undefined}
          aria-describedby={fieldErrors.summary ? 'project-summary-error' : undefined}
        />
        {fieldErrors.summary ? <ValidationMessage id="project-summary-error" message={fieldErrors.summary} /> : null}
      </div>
      <div>
        <label htmlFor="project-role">Role</label>
        <input
          id="project-role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          aria-invalid={fieldErrors.role ? 'true' : undefined}
          aria-describedby={fieldErrors.role ? 'project-role-error' : undefined}
        />
        {fieldErrors.role ? <ValidationMessage id="project-role-error" message={fieldErrors.role} /> : null}
      </div>
      <div>
        <label htmlFor="project-type">Project type</label>
        <input id="project-type" value={projectType} onChange={(event) => setProjectType(event.target.value)} />
      </div>
      <div>
        <label htmlFor="project-status">Status</label>
        <input
          id="project-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-invalid={fieldErrors.status ? 'true' : undefined}
          aria-describedby={fieldErrors.status ? 'project-status-error' : undefined}
        />
        {fieldErrors.status ? <ValidationMessage id="project-status-error" message={fieldErrors.status} /> : null}
      </div>
      <div>
        <label htmlFor="project-tags">Tags</label>
        <input
          id="project-tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          aria-invalid={fieldErrors.tags ? 'true' : undefined}
          aria-describedby={fieldErrors.tags ? 'project-tags-error' : undefined}
        />
        {fieldErrors.tags ? <ValidationMessage id="project-tags-error" message={fieldErrors.tags} /> : null}
      </div>
      <div>
        <label htmlFor="project-cover">Cover image URL</label>
        <input
          id="project-cover"
          value={coverImageUrl}
          onChange={(event) => setCoverImageUrl(event.target.value)}
          aria-invalid={fieldErrors.coverImageUrl ? 'true' : undefined}
          aria-describedby={fieldErrors.coverImageUrl ? 'project-cover-error' : undefined}
        />
        {fieldErrors.coverImageUrl ? (
          <ValidationMessage id="project-cover-error" message={fieldErrors.coverImageUrl} />
        ) : null}
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
        <select
          id="project-visibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          aria-invalid={fieldErrors.visibility ? 'true' : undefined}
          aria-describedby={fieldErrors.visibility ? 'project-visibility-error' : undefined}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
        {fieldErrors.visibility ? (
          <ValidationMessage id="project-visibility-error" message={fieldErrors.visibility} />
        ) : null}
      </div>
      {project?.publishedAt ? (
        <div>
          <span>Published at</span>
          <p>{project.publishedAt}</p>
        </div>
      ) : null}
      {message ? (
        message.includes('could not') || message.includes('Choose') ? (
          <ValidationMessage message={message} />
        ) : (
          <p role="status" aria-live="polite">{message}</p>
        )
      ) : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save project' : 'Create project')}
      </button>
      {isEditMode && visibility === 'draft' ? (
        <button type="button" onClick={() => handleVisibilityAction('publish')} disabled={visibilityAction !== null}>
          {visibilityAction === 'publish' ? 'Publishing...' : 'Publish project'}
        </button>
      ) : null}
      {isEditMode && visibility === 'published' ? (
        <button type="button" onClick={() => handleVisibilityAction('unpublish')} disabled={visibilityAction !== null}>
          {visibilityAction === 'unpublish' ? 'Unpublishing...' : 'Unpublish project'}
        </button>
      ) : null}
    </form>
  );
}
