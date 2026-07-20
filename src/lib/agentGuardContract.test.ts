import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalize, sha256Hex } from '@aadharchain/agentguard-contract';
import { describe, expect, it, vi } from 'vitest';

const fixtures = resolve(process.cwd(), '..', 'shared', 'agentguard-contract', 'fixtures');

describe('shared AgentGuard golden contract', () => {
  it('canonicalizes and hashes the shared action request exactly like Python', async () => {
    const actionRequest = JSON.parse(
      readFileSync(resolve(fixtures, 'golden-action-request.json'), 'utf8'),
    ) as Record<string, unknown>;
    const expected = readFileSync(
      resolve(fixtures, 'golden-action-request.canonical.txt'),
      'utf8',
    ).trim();

    const canonical = canonicalize(actionRequest);

    expect(canonical).toBe(expected);
    expect(await sha256Hex(canonical)).toBe(
      'b1845e24832e79a73abc2f3502a3130f9d947caf5b1c89e3c2cf8e74fa9ebab2',
    );
    expect(canonicalize(Object.fromEntries(Object.entries(actionRequest).reverse()))).toBe(expected);
  });

  it('fails closed when Web Crypto hashing is unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      await expect(sha256Hex('request')).rejects.toThrow(
        'Web Crypto SubtleCrypto is required to hash AgentGuard requests',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
