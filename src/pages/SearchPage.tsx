import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { SearchBar } from '../components/SearchBar';
import { useTrustState } from '../hooks';
import { TrustNotice } from '../components/TrustStatus';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

export function SearchPage(): JSX.Element {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const trust = useTrustState(publicKey?.toBase58() ?? null);

  function handleSearch(category: string, query: string): void {
    navigate(`/results?category=${category}&q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Buyer discovery
        </div>
        <h1 className="max-w-4xl text-[clamp(2.6rem,7vw,5.5rem)] font-semibold tracking-[-0.06em] text-foreground">
          Search the network without losing the signal.
        </h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
          Start from buyer intent, then narrow with just enough structure to compare the right
          offers before moving into trust-aware checkout.
        </p>
      </section>

      {trust.state !== 'verified' || trust.error ? (
        <TrustNotice
          state={trust.state}
          loading={trust.loading}
          error={trust.error}
          reason={trust.reason}
          actionLabel="Open AadhaarChain"
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/95 shadow-md">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full">
                Shared portfolio shell
              </Badge>
              <Badge
                variant="secondary"
                className={
                  trust.state === 'verified'
                    ? 'rounded-full bg-primary/12 text-primary'
                    : 'rounded-full bg-secondary text-secondary-foreground'
                }
              >
                {trust.loading
                  ? 'Trust checking'
                  : trust.state === 'verified'
                    ? 'Checkout ready'
                    : 'Trust action needed'}
              </Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl leading-tight sm:text-3xl">
                Find verified commerce faster
              </CardTitle>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Browse groceries, restaurants, fashion, and electronics from a single buyer shell,
                then move toward elevated checkout when the trust state allows it.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <SearchBar onSearch={handleSearch} />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <MetricCard
            label="Trust-aware checkout"
            value={trust.loading ? 'Checking' : trust.state === 'verified' ? 'Open' : 'Paused'}
            hint="Verification determines whether elevated checkout actions are available."
          />
          <MetricCard
            label="Discovery lanes"
            value="4"
            hint="Search across groceries, restaurants, fashion, and electronics."
          />
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                What this shell optimizes
              </div>
              <CardTitle className="text-xl">Uniform buyer workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Search starts broad, then narrows with just enough filter structure.</p>
              <p>Trust remains visible so checkout expectations are never ambiguous.</p>
              <p>The buyer shell stays aligned across discovery, cart, and order follow-up.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
