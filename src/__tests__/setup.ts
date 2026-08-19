import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetBuyerAgentAuthority } from '../lib/buyerAgentAuthority';

// Extend Vitest's expect with DOM assertions
import '@testing-library/jest-dom';

afterEach(() => {
  cleanup();
  resetBuyerAgentAuthority();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: unknown) => ({
    matches: false,
    media: query as string,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
