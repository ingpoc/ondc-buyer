import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrustNotice, TrustStatusChip } from './TrustStatus';
import type { PortfolioTrustState } from '../lib/trust';

describe('TrustStatus', () => {
  it.each([
    ['no_identity', 'Unsigned', 'Sign in before elevated buyer actions'],
    ['identity_present_unverified', 'Unverified', 'Identity is unverified'],
    ['manual_review', 'Manual review', 'Elevated commerce actions stay paused'],
    ['revoked_or_blocked', 'Blocked', 'blocked or revoked'],
  ] as const)('explains blocked buyer actions for %s', (state, label, message) => {
    render(<TrustNotice state={state} />);

    expect(screen.getByText(`Trust check: ${label}`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(message, 'i'))).toBeInTheDocument();
  });

  it('omits the notice when trust is verified', () => {
    const { container } = render(<TrustNotice state="verified" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['no_identity', 'Trust Unsigned'],
    ['identity_present_unverified', 'Trust Unverified'],
    ['verified', 'Trust Verified'],
    ['manual_review', 'Trust Manual review'],
    ['revoked_or_blocked', 'Trust Blocked'],
  ] as const)('renders header chip label for %s', (state: PortfolioTrustState, label) => {
    render(<TrustStatusChip state={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
