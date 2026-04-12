import { ArrowUpRight, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { cn } from '../lib/utils';
import { normalizeLoopbackUrl } from '../lib/loopback';
import type { PortfolioTrustState } from '../lib/trust';

const IDENTITY_WEB_URL = normalizeLoopbackUrl(
  import.meta.env.VITE_IDENTITY_WEB_URL || 'http://127.0.0.1:43100',
);

const STATE_META: Record<
  PortfolioTrustState,
  {
    label: string;
    chipClassName: string;
    panelClassName: string;
    icon: typeof ShieldAlert;
  }
> = {
  no_identity: {
    label: 'No identity',
    chipClassName: 'bg-muted text-muted-foreground',
    panelClassName: 'border-border/70 bg-card text-foreground',
    icon: ShieldAlert,
  },
  identity_present_unverified: {
    label: 'Unverified',
    chipClassName: 'bg-stone-200 text-stone-800',
    panelClassName: 'border-stone-300 bg-stone-100/90 text-stone-900',
    icon: ShieldAlert,
  },
  verified: {
    label: 'Verified',
    chipClassName: 'bg-lime-100 text-lime-900',
    panelClassName: 'border-lime-200 bg-lime-50/90 text-lime-950',
    icon: ShieldCheck,
  },
  manual_review: {
    label: 'Manual review',
    chipClassName: 'bg-stone-200 text-stone-800',
    panelClassName: 'border-stone-300 bg-stone-100/90 text-stone-900',
    icon: ShieldAlert,
  },
  revoked_or_blocked: {
    label: 'Blocked',
    chipClassName: 'bg-rose-100 text-rose-800',
    panelClassName: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: ShieldX,
  },
};

function trustMessage(state: PortfolioTrustState, reason?: string | null, error?: string | null) {
  if (error) {
    return error;
  }

  if (reason) {
    return reason;
  }

  return {
    no_identity: 'Create an identity anchor in AadhaarChain before you attempt checkout.',
    identity_present_unverified:
      'Complete AadhaarChain verification before you attempt checkout.',
    manual_review:
      'Verification is under manual review. Elevated commerce actions stay paused until review completes.',
    revoked_or_blocked:
      'Your trust state is blocked or revoked. Review AadhaarChain before attempting elevated actions.',
    verified: '',
  }[state];
}

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
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:text-primary"
    >
      <span
        className={cn(
          'inline-flex size-2.5 rounded-full',
          loading ? 'bg-muted-foreground' : meta.chipClassName.split(' ')[0],
        )}
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
      <Card className="border-border/70 bg-card/80">
        <CardContent className="flex items-start gap-3 py-5">
          <ShieldAlert className="mt-0.5 size-4 text-muted-foreground" />
          <div className="space-y-1">
            <div className="text-sm font-semibold">Loading AadhaarChain trust state</div>
            <p className="text-sm text-muted-foreground">
              Checking verification signals before enabling elevated buyer actions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === 'verified' && !error) {
    return null;
  }

  const meta = STATE_META[state];
  const Icon = meta.icon;

  return (
    <Card className={cn('border shadow-none', meta.panelClassName)}>
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-2">
            <Badge variant="secondary" className={cn('rounded-full border-0', meta.chipClassName)}>
              AadhaarChain trust check: {meta.label}
            </Badge>
            <p className="max-w-2xl text-sm leading-6">
              {trustMessage(state, reason, error)}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <a href={`${IDENTITY_WEB_URL}/dashboard`}>
            {actionLabel}
            <ArrowUpRight className="size-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
