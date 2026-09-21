import { supabaseAdmin } from './supabase';

export const PROJECT_MEDIA_BUCKET = 'project-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const STORAGE_KEY_PREFIX = 'projects/';

let bucketEnsured = false;

export async function ensureProjectMediaBucket() {
  if (bucketEnsured) return;

  const { data } = await supabaseAdmin.storage.getBucket(PROJECT_MEDIA_BUCKET);
  if (!data) {
    await supabaseAdmin.storage.createBucket(PROJECT_MEDIA_BUCKET, { public: false });
  }

  bucketEnsured = true;
}

export async function uploadProjectMedia(key: string, buffer: Buffer, contentType: string) {
  await ensureProjectMediaBucket();

  const { error } = await supabaseAdmin.storage.from(PROJECT_MEDIA_BUCKET).upload(key, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  return key;
}

export async function createProjectMediaSignedUrl(key: string, expiresIn = SIGNED_URL_TTL_SECONDS) {
  const { data, error } = await supabaseAdmin.storage.from(PROJECT_MEDIA_BUCKET).createSignedUrl(key, expiresIn);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Could not create a signed Storage URL.');
  }

  return data.signedUrl;
}

export async function deleteProjectMedia(key: string) {
  try {
    await supabaseAdmin.storage.from(PROJECT_MEDIA_BUCKET).remove([key]);
  } catch {
    // Best-effort cleanup - a failure here must not fail the caller's own
    // delete operation (the DB row is the source of truth).
  }
}

// A stored `url`/`coverImageUrl` value can be one of: a legacy base64
// data-URL (pre-Story-9564046 image/cover uploads), a legacy self-link
// attachment download path (pre-Story-9564046 attachments - see
// isLegacyAttachmentUrl in attachments.ts), a plain user-typed external
// URL (the project editor's free-text "Cover image URL" field), or - only
// for values this module itself generated - a Storage object key. Only
// the last of those should ever be resolved through Storage; everything
// else must pass through unchanged.
export function isStorageKey(value: string) {
  return value.startsWith(STORAGE_KEY_PREFIX);
}

export async function resolveMediaUrl(value: string): Promise<string> {
  if (!value || !isStorageKey(value)) return value;

  try {
    return await createProjectMediaSignedUrl(value);
  } catch {
    return value;
  }
}

export async function resolveMediaUrls<T>(items: T[], getUrl: (item: T) => string, setUrl: (item: T, url: string) => T): Promise<T[]> {
  return Promise.all(items.map(async (item) => setUrl(item, await resolveMediaUrl(getUrl(item)))));
}

export function isDataUrl(value: string) {
  return value.startsWith('data:');
}

export function parseDataUrl(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = value.match(/^data:([^;,]*)?(;base64)?,(.*)$/s);
  if (!match) return null;

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const data = match[3];
  const buffer = isBase64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data), 'utf8');

  return { mimeType, buffer };
}
