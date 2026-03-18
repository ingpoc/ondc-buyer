import { TYPOGRAPHY } from '@portfolio-ui';
import { normalizeLoopbackUrl } from '@/lib/loopback';
import type { PortfolioTrustState } from '@/lib/trust';

const IDENTITY_WEB_URL = normalizeLoopbackUrl(import.meta.env.VITE_IDENTITY_WEB_URL || 'http://127.0.0.1:3000');

const STATE_META: Record<PortfolioTrustState, { label: string; background: string; color: string }> = {
  no_identity: {
    label: 'No identity',
    background: '#f5f5f5',
    color: '#666666',
  },
  identity_present_unverified: {
    label: 'Unverified',
    background: '#fff3e0',
    color: '#c25b12',
  },
  verified: {
    label: 'Verified',
    background: '#ecfdf3',
    color: '#166534',
  },
  manual_review: {
    label: 'Manual review',
    background: '#fef3c7',
    color: '#92400e',
  },
  revoked_or_blocked: {
    label: 'Blocked',
    background: '#fef2f2',
    color: '#b91c1c',
  },
};

export function TrustStatusChip({
  state,
  loading,
}: {
  state: PortfolioTrustState;
  loading?: boolean;
}) {
  const meta = STATE_META[state];

  return (
    <a
      href={`${IDENTITY_WEB_URL}/dashboard`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: '999px',
        textDecoration: 'none',
        backgroundColor: loading ? '#f5f5f5' : meta.background,
        color: loading ? '#666666' : meta.color,
        ...TYPOGRAPHY.bodySmall,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '999px',
          backgroundColor: loading ? '#999999' : meta.color,
        }}
      />
      {loading ? 'Trust loading' : `Trust ${meta.label}`}
    </a>
  );
}

export function TrustNotice({
  state,
  loading,
  error,
  reason,
  actionLabel = 'Open AadhaarChain',
}: {
  state: PortfolioTrustState;
  loading?: boolean;
  error?: string | null;
  reason?: string | null;
  actionLabel?: string;
}) {
  if (loading) {
    return (
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '20px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          color: '#475569',
          ...TYPOGRAPHY.bodySmall,
        }}
      >
        Loading AadhaarChain trust state…
      </div>
    );
  }

  if (state === 'verified' && !error) {
    return null;
  }

  const meta = STATE_META[state];
  const message =
    error ||
    reason ||
    ({
      no_identity: 'Create an identity anchor in AadhaarChain before you attempt checkout.',
      identity_present_unverified: 'Complete AadhaarChain verification before you attempt checkout.',
      manual_review: 'Verification is under manual review. Elevated commerce actions stay paused until review completes.',
      revoked_or_blocked: 'Your trust state is blocked or revoked. Review AadhaarChain before attempting elevated actions.',
      verified: '',
    }[state]);

  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: '24px',
        backgroundColor: meta.background,
        border: `1px solid ${meta.color}22`,
        color: meta.color,
      }}
    >
      <div style={{ ...TYPOGRAPHY.label, marginBottom: '6px' }}>
        AadhaarChain trust check: {meta.label}
      </div>
      <p style={{ margin: 0, ...TYPOGRAPHY.bodySmall }}>{message}</p>
      <a
        href={`${IDENTITY_WEB_URL}/dashboard`}
        style={{
          display: 'inline-flex',
          marginTop: '12px',
          color: meta.color,
          textDecoration: 'underline',
          ...TYPOGRAPHY.bodySmall,
        }}
      >
        {actionLabel}
      </a>
    </div>
  );
}
