import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeaderStatusRail } from './App';
import type { PortfolioTrustState } from './lib/trust';

function trustState(state: PortfolioTrustState, loading = false) {
  return {
    state,
    eligible: state === 'verified',
    reason: `reason for ${state}`,
    trust: null,
    loading,
    error: null,
  };
}

function runtimeState() {
  return {
    app_id: 'ondc-buyer' as const,
    auth_mode: 'local_cli' as const,
    model: 'test-model',
    runtime_available: true,
    agent_access: true,
    trust_state: 'verified' as const,
    trust_required_for_write: true,
    mode: 'full' as const,
    usage: {
      requests_used: 0,
      requests_limit: 0,
      period_start: '2026-05-12T00:00:00.000Z',
      period_end: '2026-06-12T00:00:00.000Z',
      estimated_cost_usd: 0,
    },
    allowed_capabilities: ['search', 'checkout_mutation'],
    blocked_reason: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
}

describe('HeaderStatusRail', () => {
  it.each([
    ['no_identity', 'Sign in required'],
    ['identity_present_unverified', 'unverified'],
    ['verified', 'verified'],
    ['manual_review', 'review'],
    ['revoked_or_blocked', 'blocked'],
  ] as const)('renders buyer header trust state for %s', (state, label) => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <HeaderStatusRail
        subjectId={null}
        walletAddress="buyer-wallet"
        runtime={runtimeState()}
        trust={trustState(state)}
        activeControl={null}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open trust status' }));
    expect(onToggle).toHaveBeenCalledWith('trust');

    rerender(
      <HeaderStatusRail
        subjectId={null}
        walletAddress="buyer-wallet"
        runtime={runtimeState()}
        trust={trustState(state)}
        activeControl="trust"
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText('Trust')).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders loading state before trust resolution finishes', () => {
    render(
      <HeaderStatusRail
        subjectId={null}
        walletAddress="buyer-wallet"
        runtime={runtimeState()}
        trust={trustState('no_identity', true)}
        activeControl="trust"
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
  });
});
