import { Link, useNavigate } from 'react-router-dom';
import { Bot, Search } from 'lucide-react';
import { SearchBar } from '../components/SearchBar';
import { useSubject, useTrustState } from '../hooks';
import { TrustNotice } from '../components/TrustStatus';
import { elevatedTrustSatisfied } from '../lib/trust';
import { Button } from '../components/ui/button';

export function SearchPage(): JSX.Element {
  const navigate = useNavigate();
  const { walletAddress, principalId } = useSubject();
  const trust = useTrustState(walletAddress);
  const elevatedOk = elevatedTrustSatisfied(trust.state, principalId);

  function handleSearch(category: string, query: string): void {
    const normalized = String(query ?? '').trim();
    navigate(`/results?category=${category}&q=${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="flex flex-col gap-4">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Ask Samantha. Shop the network.
          </h1>
          <p className="max-w-[42ch] text-base leading-relaxed text-muted-foreground">
            Your agent finds offers and checks out under AgentGuard limits you control.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild className="rounded-full px-5 active:scale-[0.98]">
              <Link to="/agent">
                <Bot data-icon="inline-start" />
                Ask Samantha
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-5 active:scale-[0.98]"
              onClick={() => document.getElementById('search-query')?.focus()}
            >
              <Search data-icon="inline-start" />
              Search catalog
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-[var(--surface-lift)]">
          <div className="text-sm font-medium text-foreground">Agent status</div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">Trust</dt>
              <dd className="font-medium text-foreground">
                {trust.loading ? 'Checking' : elevatedOk ? 'Ready' : 'Sign in required'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">Checkout</dt>
              <dd className="font-medium text-foreground">
                {elevatedOk ? 'AgentGuard enabled' : 'Locked'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Companion</dt>
              <dd className="font-medium text-primary">Samantha orb</dd>
            </div>
          </dl>
        </div>
      </section>

      {!elevatedOk || trust.error ? (
        <TrustNotice
          state={trust.state}
          loading={trust.loading}
          error={trust.error}
          reason={trust.reason}
        />
      ) : null}

      <section id="catalog-search" className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Search the network</h2>
          <p className="mt-1 max-w-[55ch] text-sm text-muted-foreground">
            {trust.loading
              ? 'Checking trust…'
              : elevatedOk
                ? 'Signed in. Elevated checkout is available via AgentGuard.'
                : 'Sign in before elevated checkout.'}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 sm:p-5">
          <SearchBar onSearch={handleSearch} />
        </div>
      </section>
    </div>
  );
}
