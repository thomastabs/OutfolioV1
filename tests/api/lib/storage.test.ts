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

// eslint-disable-next-line @typescript-eslint/no-var-requires
type StorageModule = typeof import('@/src/lib/storage');
let storage: StorageModule;

describe('storage helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // ensureProjectMediaBucket caches its result in module-level state
    // (bucketEnsured) - reset the module fresh each test so tests that
    // exercise bucket creation aren't short-circuited by an earlier test.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    storage = require('@/src/lib/storage');
    getBucketMock.mockResolvedValue({ data: { name: 'project-media' } });
    createBucketMock.mockResolvedValue({ error: null });
  });

  describe('isStorageKey', () => {
    it('recognizes only this module\'s own generated key shape', () => {
      expect(storage.isStorageKey('projects/abc/images/xyz.png')).toBe(true);
      expect(storage.isStorageKey('data:image/png;base64,aaaa')).toBe(false);
      expect(storage.isStorageKey('/api/v1/projects/abc/attachments/xyz/download?filename=a.pdf')).toBe(false);
      expect(storage.isStorageKey('https://example.com/my-photo.png')).toBe(false);
      expect(storage.isStorageKey('')).toBe(false);
    });
  });

  describe('resolveMediaUrl', () => {
    it('passes through empty, data-URL, legacy, and external values unchanged', async () => {
      await expect(storage.resolveMediaUrl('')).resolves.toBe('');
      await expect(storage.resolveMediaUrl('data:image/png;base64,aaaa')).resolves.toBe('data:image/png;base64,aaaa');
      await expect(storage.resolveMediaUrl('/api/v1/projects/abc/attachments/xyz/download?filename=a.pdf')).resolves.toBe(
        '/api/v1/projects/abc/attachments/xyz/download?filename=a.pdf',
      );
      await expect(storage.resolveMediaUrl('https://example.com/my-photo.png')).resolves.toBe('https://example.com/my-photo.png');
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('resolves a storage key to a signed URL', async () => {
      const createSignedUrl = jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null });
      fromMock.mockReturnValue({ createSignedUrl });

      await expect(storage.resolveMediaUrl('projects/abc/images/xyz.png')).resolves.toBe('https://signed.example/x');
      expect(fromMock).toHaveBeenCalledWith('project-media');
      expect(createSignedUrl).toHaveBeenCalledWith('projects/abc/images/xyz.png', 3600);
    });

    it('falls back to the raw key if signing fails, rather than throwing during serialization', async () => {
      const createSignedUrl = jest.fn().mockResolvedValue({ data: null, error: new Error('boom') });
      fromMock.mockReturnValue({ createSignedUrl });

      await expect(storage.resolveMediaUrl('projects/abc/images/xyz.png')).resolves.toBe('projects/abc/images/xyz.png');
    });
  });

  describe('uploadProjectMedia', () => {
    it('ensures the bucket exists (creating it if missing) before uploading', async () => {
      getBucketMock.mockResolvedValueOnce({ data: null });
      const upload = jest.fn().mockResolvedValue({ error: null });
      fromMock.mockReturnValue({ upload });

      const key = await storage.uploadProjectMedia('projects/abc/images/xyz.png', Buffer.from('x'), 'image/png');

      expect(createBucketMock).toHaveBeenCalledWith('project-media', { public: false });
      expect(upload).toHaveBeenCalledWith('projects/abc/images/xyz.png', Buffer.from('x'), {
        contentType: 'image/png',
        upsert: true,
      });
      expect(key).toBe('projects/abc/images/xyz.png');
    });

    it('does not re-check the bucket on a second upload within the same process', async () => {
      getBucketMock.mockResolvedValueOnce({ data: null });
      const upload = jest.fn().mockResolvedValue({ error: null });
      fromMock.mockReturnValue({ upload });

      await storage.uploadProjectMedia('projects/abc/images/one.png', Buffer.from('x'), 'image/png');
      await storage.uploadProjectMedia('projects/abc/images/two.png', Buffer.from('y'), 'image/png');

      expect(getBucketMock).toHaveBeenCalledTimes(1);
      expect(createBucketMock).toHaveBeenCalledTimes(1);
    });

    it('throws if the upload itself fails', async () => {
      const upload = jest.fn().mockResolvedValue({ error: new Error('upload failed') });
      fromMock.mockReturnValue({ upload });

      await expect(storage.uploadProjectMedia('projects/abc/images/xyz.png', Buffer.from('x'), 'image/png')).rejects.toThrow(
        'upload failed',
      );
    });

    it('tolerates a concurrent cold-start race where another invocation already created the bucket', async () => {
      // Two serverless invocations can both see the bucket missing and
      // both try to create it; only one wins.
      getBucketMock.mockResolvedValueOnce({ data: null });
      createBucketMock.mockResolvedValueOnce({ error: new Error('Bucket already exists') });
      const upload = jest.fn().mockResolvedValue({ error: null });
      fromMock.mockReturnValue({ upload });

      await expect(storage.uploadProjectMedia('projects/abc/images/xyz.png', Buffer.from('x'), 'image/png')).resolves.toBe(
        'projects/abc/images/xyz.png',
      );
      expect(upload).toHaveBeenCalled();
    });

    it('still throws if bucket creation fails for a reason other than already existing', async () => {
      getBucketMock.mockResolvedValueOnce({ data: null });
      createBucketMock.mockResolvedValueOnce({ error: new Error('permission denied') });

      await expect(storage.uploadProjectMedia('projects/abc/images/xyz.png', Buffer.from('x'), 'image/png')).rejects.toThrow(
        'permission denied',
      );
    });
  });

  describe('createProjectMediaSignedUrl', () => {
    it('throws when the Storage API reports an error', async () => {
      const createSignedUrl = jest.fn().mockResolvedValue({ data: null, error: new Error('nope') });
      fromMock.mockReturnValue({ createSignedUrl });

      await expect(storage.createProjectMediaSignedUrl('projects/abc/images/xyz.png')).rejects.toThrow('nope');
    });
  });
});
