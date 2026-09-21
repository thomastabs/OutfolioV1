'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, EyeOff, FileArchive, ImagePlus, Save, Send, Trash2, Upload } from 'lucide-react';
import { ValidationMessage } from '../components/ValidationMessage';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
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

type OmlAttachment = {
  id: string;
  filename: string;
  url: string;
  fileType?: string;
  fileSize?: number;
  order?: number;
  metadata?: {
    moduleName: string;
    version: string;
  } | null;
};

type AttachmentResponse = {
  attachments?: OmlAttachment[];
  error?: string;
  message?: string;
};

type ProjectImage = {
  id: string;
  url: string;
  order?: number;
};

type ImageResponse = {
  images?: ProjectImage[];
  error?: string;
  message?: string;
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

const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

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

function formatFileSize(size = 0) {
  if (size <= 0) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
  const [omlAttachments, setOmlAttachments] = useState<OmlAttachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [selectedOmlFile, setSelectedOmlFile] = useState<File | null>(null);
  const [isUploadingOml, setIsUploadingOml] = useState(false);
  const [attachmentMessage, setAttachmentMessage] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [omlInputKey, setOmlInputKey] = useState(0);
  const [projectImages, setProjectImages] = useState<ProjectImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageInputKey, setImageInputKey] = useState(0);

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

  useEffect(() => {
    let ignore = false;

    async function loadAttachments(projectId: string) {
      setIsLoadingAttachments(true);
      setAttachmentError('');
      setAttachmentMessage('');

      try {
        const response = await fetch(`/api/v1/projects/${projectId}/attachments`);
        if (!response?.ok) return;
        const data = await response.json() as AttachmentResponse;
        if (!ignore) {
          setOmlAttachments(Array.isArray(data.attachments) ? data.attachments : []);
        }
      } catch {
        if (!ignore) {
          setAttachmentError('Could not load .oml attachments.');
        }
      } finally {
        if (!ignore) {
          setIsLoadingAttachments(false);
        }
      }
    }

    if (project?.id) {
      loadAttachments(project.id);
    } else {
      setOmlAttachments([]);
      setSelectedOmlFile(null);
      setAttachmentError('');
      setAttachmentMessage('');
      setIsLoadingAttachments(false);
    }

    return () => {
      ignore = true;
    };
  }, [project?.id]);

  useEffect(() => {
    let ignore = false;

    async function loadImages(projectId: string) {
      setIsLoadingImages(true);
      setImageError('');
      setImageMessage('');

      try {
        const response = await fetch(`/api/v1/projects/${projectId}/images`);
        if (!response?.ok) return;
        const data = await response.json() as ImageResponse;
        if (!ignore) {
          setProjectImages(Array.isArray(data.images) ? data.images : []);
        }
      } catch {
        if (!ignore) {
          setImageError('Could not load project images.');
        }
      } finally {
        if (!ignore) {
          setIsLoadingImages(false);
        }
      }
    }

    if (project?.id) {
      loadImages(project.id);
    } else {
      setProjectImages([]);
      setSelectedImageFiles([]);
      setImageError('');
      setImageMessage('');
      setIsLoadingImages(false);
    }

    return () => {
      ignore = true;
    };
  }, [project?.id]);

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

  function handleOmlFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    setSelectedOmlFile(file ?? null);
    setAttachmentError('');
    setAttachmentMessage('');
  }

  async function handleOmlUpload() {
    if (!project?.id || !selectedOmlFile) return;

    setIsUploadingOml(true);
    setAttachmentError('');
    setAttachmentMessage('Uploading .oml file...');

    const formData = new FormData();
    formData.append('files', selectedOmlFile);

    try {
      const response = await fetch(`/api/v1/projects/${project.id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json() as AttachmentResponse;

      if (!response.ok) {
        setAttachmentMessage('');
        setAttachmentError(
          data.message ??
          (data.error === 'invalid_oml_file'
            ? 'The uploaded .oml file is invalid or corrupted. Please upload a valid file.'
            : 'Could not upload the .oml attachment.'),
        );
        return;
      }

      const uploaded = Array.isArray(data.attachments) ? data.attachments : [];
      setOmlAttachments((current) => [...current, ...uploaded]);
      setSelectedOmlFile(null);
      setOmlInputKey((key) => key + 1);
      setAttachmentMessage('The .oml attachment was uploaded and validated.');
    } catch {
      setAttachmentMessage('');
      setAttachmentError('Could not upload the .oml attachment.');
    } finally {
      setIsUploadingOml(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!project?.id) return;

    setAttachmentError('');
    setAttachmentMessage('');

    try {
      const response = await fetch(`/api/v1/projects/${project.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setAttachmentError('Could not delete the .oml attachment.');
        return;
      }

      setOmlAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
      setAttachmentMessage('The .oml attachment was deleted.');
    } catch {
      setAttachmentError('Could not delete the .oml attachment.');
    }
  }

  async function persistAttachmentOrder(nextAttachments: OmlAttachment[]) {
    if (!project?.id) return;

    try {
      await fetch(`/api/v1/projects/${project.id}/attachments/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: nextAttachments.map((attachment) => attachment.id) }),
      });
    } catch {
      setAttachmentError('Could not save the attachment order.');
    }
  }

  function handleMoveAttachment(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= omlAttachments.length) return;

    const nextAttachments = [...omlAttachments];
    [nextAttachments[index], nextAttachments[targetIndex]] = [nextAttachments[targetIndex], nextAttachments[index]];
    setOmlAttachments(nextAttachments);
    setAttachmentMessage('Attachment order updated.');
    setAttachmentError('');
    persistAttachmentOrder(nextAttachments);
  }

  function validateImageFiles(files: File[]) {
    const unsupported = files.find((file) => !IMAGE_MIME_TYPES.has(file.type));
    if (unsupported) {
      return 'Only JPEG, PNG, GIF, or WebP images can be uploaded.';
    }

    const oversized = files.find((file) => file.size > MAX_IMAGE_FILE_SIZE_BYTES);
    if (oversized) {
      return 'Images must be 10 MiB or smaller.';
    }

    return '';
  }

  function handleImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setImageMessage('');

    const validationError = validateImageFiles(files);
    if (validationError) {
      setSelectedImageFiles([]);
      setImageError(validationError);
      return;
    }

    setSelectedImageFiles(files);
    setImageError('');
  }

  async function handleImageUpload() {
    if (!project?.id || selectedImageFiles.length === 0) return;

    const validationError = validateImageFiles(selectedImageFiles);
    if (validationError) {
      setImageError(validationError);
      return;
    }

    setIsUploadingImages(true);
    setImageError('');
    setImageMessage('Uploading project images...');

    const formData = new FormData();
    selectedImageFiles.forEach((file) => formData.append('files', file));

    try {
      const response = await fetch(`/api/v1/projects/${project.id}/images`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json() as ImageResponse;

      if (!response.ok) {
        setImageMessage('');
        setImageError(data.message ?? 'Could not upload project images.');
        return;
      }

      setProjectImages(Array.isArray(data.images) ? data.images : projectImages);
      setSelectedImageFiles([]);
      setImageInputKey((key) => key + 1);
      setImageMessage('Project images uploaded.');
    } catch {
      setImageMessage('');
      setImageError('Could not upload project images.');
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!project?.id) return;

    setImageError('');
    setImageMessage('');

    try {
      const response = await fetch(`/api/v1/projects/${project.id}/images/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setImageError('Could not delete the project image.');
        return;
      }

      setProjectImages((current) => current.filter((image) => image.id !== imageId));
      setImageMessage('Project image deleted.');
    } catch {
      setImageError('Could not delete the project image.');
    }
  }

  async function persistImageOrder(nextImages: ProjectImage[]) {
    if (!project?.id) return;

    try {
      const response = await fetch(`/api/v1/projects/${project.id}/images/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: nextImages.map((image) => image.id) }),
      });

      if (!response.ok) {
        setImageError('Could not save the image order.');
      }
    } catch {
      setImageError('Could not save the image order.');
    }
  }

  function handleMoveImage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= projectImages.length) return;

    const nextImages = [...projectImages];
    [nextImages[index], nextImages[targetIndex]] = [nextImages[targetIndex], nextImages[index]];
    setProjectImages(nextImages);
    setImageMessage('Image order updated.');
    setImageError('');
    persistImageOrder(nextImages);
  }

  return (
    <form className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Project editor" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-title">Title</label>
        <Input
          id="project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={fieldErrors.title ? 'true' : undefined}
          aria-describedby={fieldErrors.title ? 'project-title-error' : undefined}
        />
        {fieldErrors.title ? <ValidationMessage id="project-title-error" message={fieldErrors.title} /> : null}
      </div>
      <div className="grid gap-2 md:col-span-2">
        <label className="text-sm font-semibold" htmlFor="project-summary">Summary</label>
        <Textarea
          id="project-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          aria-invalid={fieldErrors.summary ? 'true' : undefined}
          aria-describedby={fieldErrors.summary ? 'project-summary-error' : undefined}
        />
        {fieldErrors.summary ? <ValidationMessage id="project-summary-error" message={fieldErrors.summary} /> : null}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-role">Role</label>
        <Input
          id="project-role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          aria-invalid={fieldErrors.role ? 'true' : undefined}
          aria-describedby={fieldErrors.role ? 'project-role-error' : undefined}
        />
        {fieldErrors.role ? <ValidationMessage id="project-role-error" message={fieldErrors.role} /> : null}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-type">Project type</label>
        <Input id="project-type" value={projectType} onChange={(event) => setProjectType(event.target.value)} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-status">Status</label>
        <Input
          id="project-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-invalid={fieldErrors.status ? 'true' : undefined}
          aria-describedby={fieldErrors.status ? 'project-status-error' : undefined}
        />
        {fieldErrors.status ? <ValidationMessage id="project-status-error" message={fieldErrors.status} /> : null}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-tags">Tags</label>
        <Input
          id="project-tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          aria-invalid={fieldErrors.tags ? 'true' : undefined}
          aria-describedby={fieldErrors.tags ? 'project-tags-error' : undefined}
        />
        {fieldErrors.tags ? <ValidationMessage id="project-tags-error" message={fieldErrors.tags} /> : null}
      </div>
      <div className="grid gap-2 md:col-span-2">
        <label className="text-sm font-semibold" htmlFor="project-cover">Cover image URL</label>
        <Input
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
      <div className="grid gap-2 md:col-span-2 xl:col-span-3">
        <label className="text-sm font-semibold" htmlFor="project-problem">Problem</label>
        <Textarea id="project-problem" value={problem} onChange={(event) => setProblem(event.target.value)} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-features">Features</label>
        <Textarea id="project-features" value={features} onChange={(event) => setFeatures(event.target.value)} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-technical-notes">Technical notes</label>
        <Textarea id="project-technical-notes" value={technicalNotes} onChange={(event) => setTechnicalNotes(event.target.value)} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-contribution">Contribution</label>
        <Textarea id="project-contribution" value={contribution} onChange={(event) => setContribution(event.target.value)} />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <label className="text-sm font-semibold" htmlFor="project-outcome">Outcome</label>
        <Textarea id="project-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="project-visibility">Visibility</label>
        <select
          id="project-visibility"
          className="h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm"
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
        <div className="grid gap-2">
          <span className="text-sm font-semibold">Published at</span>
          <Badge className="w-fit rounded-full" variant="success">{project.publishedAt}</Badge>
        </div>
      ) : null}
      {isEditMode ? (
        <section className="rounded-xl border border-border bg-card/70 p-4 shadow-sm md:col-span-2 xl:col-span-3" aria-labelledby="project-image-gallery-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="project-image-gallery-heading" className="flex items-center gap-2 text-base font-semibold">
                <ImagePlus className="h-4 w-4 text-primary" aria-hidden="true" />
                Project image gallery
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add screenshots or visual evidence that helps the case study read like a real portfolio piece.
              </p>
            </div>
            {isLoadingImages ? (
              <Badge className="w-fit rounded-full" variant="secondary">Loading images...</Badge>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-border bg-background/80 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <label className="text-sm font-semibold" htmlFor="project-image-files">Image files</label>
              <input
                key={imageInputKey}
                id="project-image-files"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onChange={handleImageFileChange}
                aria-describedby={imageError ? 'project-images-error' : undefined}
                aria-invalid={imageError ? 'true' : undefined}
              />
              {selectedImageFiles.length > 0 ? (
                <p className="text-xs font-medium text-muted-foreground">
                  Selected {selectedImageFiles.length} image{selectedImageFiles.length === 1 ? '' : 's'} ({selectedImageFiles.map((file) => file.name).join(', ')})
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              onClick={handleImageUpload}
              disabled={selectedImageFiles.length === 0 || isUploadingImages}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {isUploadingImages ? 'Uploading...' : 'Upload images'}
            </Button>
          </div>

          <div className="mt-3" aria-live="polite">
            {imageError ? <ValidationMessage id="project-images-error" message={imageError} /> : null}
            {imageMessage && !imageError ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800" role="status">
                {imageMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectImages.length === 0 && !isLoadingImages ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                No project images yet.
              </p>
            ) : null}
            {projectImages.map((image, index) => (
              <article key={image.id} className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                <div className="aspect-video bg-muted">
                  <img
                    src={image.url}
                    alt={`Project gallery image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="text-sm font-semibold">Image {index + 1}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleMoveImage(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move image ${index + 1} up`}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleMoveImage(index, 1)}
                      disabled={index === projectImages.length - 1}
                      aria-label={`Move image ${index + 1} down`}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteImage(image.id)}
                      aria-label={`Delete image ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {isEditMode ? (
        <section className="rounded-xl border border-border bg-card/70 p-4 shadow-sm md:col-span-2 xl:col-span-3" aria-labelledby="project-oml-attachments-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="project-oml-attachments-heading" className="flex items-center gap-2 text-base font-semibold">
                <FileArchive className="h-4 w-4 text-primary" aria-hidden="true" />
                OutSystems .oml attachments
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a module export to preserve the technical artifact behind this case study.
              </p>
            </div>
            {isLoadingAttachments ? (
              <Badge className="w-fit rounded-full" variant="secondary">Loading attachments...</Badge>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-border bg-background/80 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <label className="text-sm font-semibold" htmlFor="project-oml-file">.oml file</label>
              <input
                key={omlInputKey}
                id="project-oml-file"
                type="file"
                accept=".oml"
                className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onChange={handleOmlFileChange}
                aria-describedby={attachmentError ? 'project-oml-error' : undefined}
                aria-invalid={attachmentError ? 'true' : undefined}
              />
              {selectedOmlFile ? (
                <p className="text-xs font-medium text-muted-foreground">
                  Selected {selectedOmlFile.name} ({formatFileSize(selectedOmlFile.size)})
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              onClick={handleOmlUpload}
              disabled={!selectedOmlFile || isUploadingOml}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {isUploadingOml ? 'Uploading...' : 'Upload .oml'}
            </Button>
          </div>

          <div className="mt-3" aria-live="polite">
            {attachmentError ? <ValidationMessage id="project-oml-error" message={attachmentError} /> : null}
            {attachmentMessage && !attachmentError ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800" role="status">
                {attachmentMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            {omlAttachments.length === 0 && !isLoadingAttachments ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                No .oml attachments yet.
              </p>
            ) : null}
            {omlAttachments.map((attachment, index) => (
              <article key={attachment.id} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold">{attachment.filename}</h4>
                  <dl className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-foreground">Module</dt>
                      <dd>{attachment.metadata?.moduleName ?? 'Unknown module'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Version</dt>
                      <dd>{attachment.metadata?.version ?? 'unknown'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Size</dt>
                      <dd>{formatFileSize(attachment.fileSize)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleMoveAttachment(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${attachment.filename} up`}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleMoveAttachment(index, 1)}
                    disabled={index === omlAttachments.length - 1}
                    aria-label={`Move ${attachment.filename} down`}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteAttachment(attachment.id)}
                    aria-label={`Delete ${attachment.filename}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-3">
        {message ? (
        message.includes('could not') || message.includes('Choose') ? (
          <ValidationMessage message={message} />
        ) : (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800" role="status" aria-live="polite">{message}</p>
        )
      ) : null}
      </div>
      <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-3">
      <Button type="submit" disabled={isSubmitting}>
        <Save className="h-4 w-4" aria-hidden="true" />
        {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save project' : 'Create project')}
      </Button>
      {isEditMode && visibility === 'draft' ? (
        <Button type="button" onClick={() => handleVisibilityAction('publish')} disabled={visibilityAction !== null}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {visibilityAction === 'publish' ? 'Publishing...' : 'Publish project'}
        </Button>
      ) : null}
      {isEditMode && visibility === 'published' ? (
        <Button type="button" variant="secondary" onClick={() => handleVisibilityAction('unpublish')} disabled={visibilityAction !== null}>
          <EyeOff className="h-4 w-4" aria-hidden="true" />
          {visibilityAction === 'unpublish' ? 'Unpublishing...' : 'Unpublish project'}
        </Button>
      ) : null}
      </div>
    </form>
  );
}
