import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SamanthaOrb } from './SamanthaOrb';
import { applyBuyerAgentControl, getBuyerAgentAuthority } from '../lib/buyerAgentAuthority';

vi.mock('../hooks', () => ({
  useSubject: () => ({ subjectId: 'principal:demo:test', walletAddress: null }),
  useCart: () => ({
    session: { id: 'session-1', items: [] },
    subtotal: 0,
    addToCart: vi.fn(),
    clearCart: vi.fn(),
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    refreshCart: vi.fn(),
  }),
}));

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Buyer Samantha dialog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/realtime/')) {
          return jsonResponse({ configured: false });
        }
        return jsonResponse({
          agent: { agent_id: 'agent-buyer-1', status: 'active', role: 'buyer' },
          mandate: { mandate_id: 'mandate-1', status: 'active' },
          receipts: [],
        });
      }),
    );
  });

  it('opens as a named dialog, focuses text, explains mic state, and closes with Escape', async () => {
    render(
      <MemoryRouter>
        <SamanthaOrb />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Samantha' });
    fireEvent.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Samantha' })).toBeVisible();
    const input = screen.getByRole('textbox', { name: 'Ask Samantha' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByTestId('samantha-mic-status')).toHaveTextContent(
      'Microphone off. Text remains available.',
    );

    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Samantha' })).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Samantha' })).toHaveFocus());
  });

  it('does not resume AgentGuard authority just by opening chat', async () => {
    applyBuyerAgentControl(
      { agent_id: 'agent-buyer-1', principal_id: 'principal:demo:test', role: 'buyer', status: 'paused' },
      true,
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/ensure') || url.includes('/resume') || url.includes('/pause')) {
        throw new Error(`open chat must not call ${url}`);
      }
      if (url.includes('/api/realtime/')) {
        return jsonResponse({ configured: false });
      }
      return jsonResponse({
        agent: { agent_id: 'agent-buyer-1', status: 'active', role: 'buyer' },
        mandate: { mandate_id: 'mandate-1', status: 'active' },
        receipts: [],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SamanthaOrb />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Samantha' }));
    expect(await screen.findByRole('dialog', { name: 'Samantha' })).toBeVisible();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/agents/current'))).toBe(
        true,
      ),
    );

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => /\/(pause|resume|ensure)\b/.test(url))).toBe(false);
    expect(getBuyerAgentAuthority().explicitPaused).toBe(true);
    expect(getBuyerAgentAuthority().agent?.status).toBe('paused');
  });
});
