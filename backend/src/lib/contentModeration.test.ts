import { afterEach, describe, expect, it, vi } from 'vitest';
import { moderateImageContent, moderateTextContent } from './contentModeration';

const originalNodeEnv = process.env.NODE_ENV;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalEnforcement = process.env.MODERATION_ENFORCEMENT;
const originalTestRemote = process.env.MODERATION_TEST_REMOTE;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalEnforcement === undefined) delete process.env.MODERATION_ENFORCEMENT;
  else process.env.MODERATION_ENFORCEMENT = originalEnforcement;
  if (originalTestRemote === undefined) delete process.env.MODERATION_TEST_REMOTE;
  else process.env.MODERATION_TEST_REMOTE = originalTestRemote;
  vi.unstubAllGlobals();
});

describe('content moderation', () => {
  it('blocks normalized local safety violations without a provider call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await moderateTextContent(['k1ll yourself']);

    expect(result?.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed in production when provider credentials are missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.OPENAI_API_KEY;
    delete process.env.MODERATION_ENFORCEMENT;

    const result = await moderateImageContent(Buffer.from('image'), 'image/png');

    expect(result?.status).toBe(503);
  });

  it('uses the multimodal provider result for image moderation', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.MODERATION_TEST_REMOTE = 'true';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ flagged: true }] }),
    }));

    const result = await moderateImageContent(Buffer.from('image'), 'image/png');

    expect(result?.status).toBe(400);
  });
});
