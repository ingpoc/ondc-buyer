import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerConfigPage, coercePrefTab } from './BuyerConfigPage';
import { SamanthaOrb } from '../components/SamanthaOrb';
import { getBuyerAgentAuthority, resetBuyerAgentAuthority } from '../lib/buyerAgentAuthority';

vi.mock('../hooks', () => ({
  useAuth: () => ({
    user: { display_name: 'Test Buyer', email: 'buyer@example.com' },
    isAuthenticated: true,
  }),
  useCart: () => ({
    session: { id: 'session-1', buyer: { name: 'Test Buyer' }, items: [] },
    subtotal: 0,
    addToCart: vi.fn(),
    clearCart: vi.fn(),
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    refreshCart: vi.fn(),
  }),
  useSubject: () => ({
    walletAddress: null,
    subjectId: 'principal:demo:buyer',
    principalId: 'principal:demo:buyer',
  }),
}));

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function agentPayload(status: 'active' | 'paused') {
  return {
    agent: { agent_id: 'agent-buyer-1', status, role: 'buyer', principal_id: 'principal:demo:buyer' },
    mandate: {
      mandate_id: 'mandate-1',
      status: 'active',
      limits: { auto_approve_max_inr: { 'buyer.checkout.commit': 10000 } },
    },
    receipts: [
      {
        receipt_id: 'receipt-1',
        agent_id: 'agent-buyer-1',
        action: 'buyer.checkout.commit',
        amount_inr: 89,
        resource_id: 'order-1',
        outcome: 'executed',
        created_at: '2026-08-19T10:00:00Z',
      },
    ],
  };
}

function pauseFetchMock() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/agents/agent-buyer-1/pause') && method === 'POST') {
      return jsonResponse({ agent: agentPayload('paused').agent });
    }
    if (url.includes('/agents/agent-buyer-1/resume') && method === 'POST') {
      return jsonResponse({ agent: agentPayload('active').agent });
    }
    if (url.includes('/receipts/verify')) {
      return jsonResponse({ valid: true });
    }
    if (url.includes('/ensure')) {
      throw new Error('ensure must not run as a pause/resume side effect');
    }
    if (url.includes('/api/realtime/')) {
      return jsonResponse({ configured: false });
    }
    // Status polls report active even after pause — UI must stay paused until Resume.
    return jsonResponse(agentPayload('active'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Buyer preference tabs', () => {
  it('maps agent-guard deep-link aliases onto the mandate tab', () => {
    expect(coercePrefTab('agent-guard')).toBe('agent-guard');
    expect(coercePrefTab('agentguard')).toBe('agent-guard');
    expect(coercePrefTab('mandate')).toBe('agent-guard');
  });

  it('opens the Agent Guard tab from /config?tab=agent-guard', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(agentPayload('active'))));

    render(
      <MemoryRouter initialEntries={['/config?tab=agent-guard']}>
        <BuyerConfigPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('buyer-config-tab-agent-guard')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('buyer-config-agentguard')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pause shopping agent' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Shopping agent on')).toBeInTheDocument());
    expect(screen.getByTestId('buyer-config-tab-agent-guard')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('buyer-config-tab-profile')).not.toHaveAttribute('data-active', 'true');
  });
});

describe('Buyer agent pause authority', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetBuyerAgentAuthority();
  });

  it('stays paused across opening Samantha and verifying an Intent Receipt', async () => {
    const fetchMock = pauseFetchMock();

    render(
      <MemoryRouter initialEntries={['/config?tab=agent-guard']}>
        <BuyerConfigPage />
        <SamanthaOrb />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Shopping agent on')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('buyer-config-toggle-agent'));
    await waitFor(() => expect(screen.getByText('Shopping agent paused')).toBeInTheDocument());
    expect(screen.getByTestId('buyer-config-agent-note')).toHaveTextContent('Agent paused');

    fireEvent.click(screen.getByRole('button', { name: 'Open Samantha' }));
    expect(await screen.findByRole('dialog', { name: 'Samantha' })).toBeVisible();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/agents/current'))).toBe(
        true,
      ),
    );

    const { verifyBuyerReceipt, syncBuyerAgentGuardStatus } = await import('../lib/agentGuardCheckout');
    await expect(verifyBuyerReceipt({ receiptId: 'receipt-1' })).resolves.toEqual({ valid: true });
    await waitFor(async () => {
      const afterVerify = await syncBuyerAgentGuardStatus();
      expect(afterVerify.snapshot.agent?.status).toBe('paused');
    });

    expect(fetchMock.mock.calls.some((call) => String((call as unknown[])[0]).includes('/resume'))).toBe(
      false,
    );
    expect(fetchMock.mock.calls.some((call) => String((call as unknown[])[0]).includes('/ensure'))).toBe(
      false,
    );
    expect(getBuyerAgentAuthority().agent?.status).toBe('paused');
    expect(screen.getByText('Shopping agent paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume shopping agent' })).toBeInTheDocument();
    expect(screen.queryByText('Agent resumed. Protected actions may run within the mandate.')).toBeNull();

    fireEvent.click(screen.getByTestId('buyer-config-toggle-agent'));
    await waitFor(() => expect(screen.getByText('Shopping agent on')).toBeInTheDocument());
    expect(fetchMock.mock.calls.some((call) => String((call as unknown[])[0]).includes('/resume'))).toBe(
      true,
    );
    expect(screen.getByTestId('buyer-config-agent-note')).toHaveTextContent('Agent resumed');
  });
});
