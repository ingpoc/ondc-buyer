import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { Badge, Card, PageLayout, Section, StatCard } from '@portfolio-ui';
import { SearchBar } from '../components/SearchBar';
import { useTrustState } from '../hooks';
import { TrustNotice } from '../components/TrustStatus';

export function SearchPage(): JSX.Element {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const trust = useTrustState(publicKey?.toBase58() ?? null);

  function handleSearch(category: string, query: string): void {
    navigate(`/results?category=${category}&q=${encodeURIComponent(query)}`);
  }

  return (
    <PageLayout>
      <Section
        eyebrow="Buyer discovery"
        title="Find verified commerce faster"
        description="Start from buyer intent, then narrow with just enough structure to compare the right offers."
      >
        {trust.state !== 'verified' || trust.error ? (
          <TrustNotice
            state={trust.state}
            loading={trust.loading}
            error={trust.error}
            reason={trust.reason}
            actionLabel="Open AadhaarChain"
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">Shared portfolio shell</Badge>
              <Badge tone={trust.state === 'verified' ? 'success' : 'warning'}>
                {trust.loading
                  ? 'Trust checking'
                  : trust.state === 'verified'
                    ? 'Checkout ready'
                    : 'Trust action needed'}
              </Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-[clamp(2.2rem,5vw,4.2rem)] font-bold tracking-[-0.06em] text-[var(--ui-text)]">
                Search the network without losing the signal.
              </h1>
              <p className="max-w-2xl text-base text-[var(--ui-text-secondary)] sm:text-lg">
                Browse groceries, restaurants, fashion, and electronics from a single buyer shell,
                then move toward trust-aware checkout once the right seller appears.
              </p>
            </div>

            <SearchBar onSearch={handleSearch} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard
              label="Trust-aware checkout"
              value={trust.loading ? 'Checking' : trust.state === 'verified' ? 'Open' : 'Paused'}
              hint="Verification determines whether elevated checkout actions are available."
              tone={trust.state === 'verified' ? 'success' : 'warning'}
            />
            <StatCard
              label="Discovery lanes"
              value={4}
              hint="Search across groceries, restaurants, fashion, and electronics."
              tone="info"
            />
            <Card className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
                What this shell optimizes
              </div>
              <div className="space-y-3 text-sm text-[var(--ui-text-secondary)]">
                <p>Search starts broad, then narrows with just enough filter structure.</p>
                <p>Shared components keep buyer and seller flows visually aligned.</p>
                <p>Trust stays visible so checkout expectations are never ambiguous.</p>
              </div>
            </Card>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
