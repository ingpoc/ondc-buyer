import { describe, expect, it } from 'vitest';

import { verifiedRuntimeSummary } from './samanthaRuntimeHandoff';

describe('Buyer runtime completion evidence', () => {
  it('rejects a result without executed tools', () => {
    expect(verifiedRuntimeSummary({
      status: 'completed',
      summary: 'Created the weekly basket.',
      executed_tools: [],
      postcondition: { verified: true, evidence: 'Basket exists.' },
    })).toBeNull();
  });

  it('accepts a tool-backed verified postcondition', () => {
    expect(verifiedRuntimeSummary({
      status: 'completed',
      summary: 'Created the weekly basket.',
      executed_tools: ['commerce_api'],
      postcondition: { verified: true, evidence: 'Read-back returned basket weekly-1.' },
    })).toBe('Created the weekly basket.');
  });
});
