const fromMock = jest.fn();
const getBucketMock = jest.fn();
const createBucketMock = jest.fn();

jest.mock('@/src/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: (...args: unknown[]) => fromMock(...args),
      getBucket: (...args: unknown[]) => getBucketMock(...args),
      createBucket: (...args: unknown[]) => createBucketMock(...args),
    },
  },
}));

import { createProjectMediaSignedUrl, isStorageKey, resolveMediaUrl, uploadProjectMedia } from '@/src/lib/storage';

describe('storage helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBucketMock.mockResolvedValue({ data: { name: 'project-media' } });
  });

  describe('isStorageKey', () => {
    it('recognizes only this module\'s own generated key shape', () => {
      expect(isStorageKey('projects/abc/images/xyz.png')).toBe(true);
      expect(isStorageKey('data:image/png;base64,aaaa')).toBe(false);
      expect(isStorageKey('/api/v1/projects/abc/attachments/xyz/download?filename=a.pdf')).toBe(false);
      expect(isStorageKey('https://example.com/my-photo.png')).toBe(false);
      expect(isStorageKey('')).toBe(false);
    });
  });

  describe('resolveMediaUrl', () => {
    it('passes through empty, data-URL, legacy, and external values unchanged', async () => {
      await expect(resolveMediaUrl('')).resolves.toBe('');
      await expect(resolveMediaUrl('data:image/png;base64,aaaa')).resolves.toBe('data:image/png;base64,aaaa');
      await expect(resolveMediaUrl('/api/v1/projects/abc/attachments/xyz/download?filename=a.pdf')).resolves.toBe(
        '/api/v1/projects/abc/attachments/xyz/download?filename=a.pdf',
      );
      await expect(resolveMediaUrl('https://example.com/my-photo.png')).resolves.toBe('https://example.com/my-photo.png');
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('resolves a storage key to a signed URL', async () => {
      const createSignedUrl = jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null });
      fromMock.mockReturnValue({ createSignedUrl });

      await expect(resolveMediaUrl('projects/abc/images/xyz.png')).resolves.toBe('https://signed.example/x');
      expect(fromMock).toHaveBeenCalledWith('project-media');
      expect(createSignedUrl).toHaveBeenCalledWith('projects/abc/images/xyz.png', 3600);
    });

    it('falls back to the raw key if signing fails, rather than throwing during serialization', async () => {
      const createSignedUrl = jest.fn().mockResolvedValue({ data: null, error: new Error('boom') });
      fromMock.mockReturnValue({ createSignedUrl });

      await expect(resolveMediaUrl('projects/abc/images/xyz.png')).resolves.toBe('projects/abc/images/xyz.png');
    });
  });

  describe('uploadProjectMedia', () => {
    it('ensures the bucket exists (creating it if missing) before uploading', async () => {
      getBucketMock.mockResolvedValueOnce({ data: null });
      const upload = jest.fn().mockResolvedValue({ error: null });
      fromMock.mockReturnValue({ upload });

      const key = await uploadProjectMedia('projects/abc/images/xyz.png', Buffer.from('x'), 'image/png');

      expect(createBucketMock).toHaveBeenCalledWith('project-media', { public: false });
      expect(upload).toHaveBeenCalledWith('projects/abc/images/xyz.png', Buffer.from('x'), {
        contentType: 'image/png',
        upsert: true,
      });
      expect(key).toBe('projects/abc/images/xyz.png');
    });

    it('throws if the upload itself fails', async () => {
      const upload = jest.fn().mockResolvedValue({ error: new Error('upload failed') });
      fromMock.mockReturnValue({ upload });

      await expect(uploadProjectMedia('projects/abc/images/xyz.png', Buffer.from('x'), 'image/png')).rejects.toThrow(
        'upload failed',
      );
    });
  });

  describe('createProjectMediaSignedUrl', () => {
    it('throws when the Storage API reports an error', async () => {
      const createSignedUrl = jest.fn().mockResolvedValue({ data: null, error: new Error('nope') });
      fromMock.mockReturnValue({ createSignedUrl });

      await expect(createProjectMediaSignedUrl('projects/abc/images/xyz.png')).rejects.toThrow('nope');
    });
  });
});
