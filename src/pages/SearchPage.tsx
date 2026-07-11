import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { useSubject, useTrustState } from '../hooks';
import { TrustNotice } from '../components/TrustStatus';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function SearchPage(): JSX.Element {
  const navigate = useNavigate();
  const { walletAddress } = useSubject();
  const trust = useTrustState(walletAddress);

  function handleSearch(category: string, query: string): void {
    const normalized = String(query ?? '').trim();
    navigate(`/results?category=${category}&q=${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Buyer discovery
        </div>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Search verified commerce
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Find offers, then checkout when AadhaarChain trust allows elevated actions.
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

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl sm:text-2xl">Search the network</CardTitle>
          <p className="text-sm text-muted-foreground">
            {trust.loading
              ? 'Checking trust…'
              : trust.state === 'verified'
                ? 'Trust verified — elevated checkout is available.'
                : 'Trust action needed before elevated checkout.'}
          </p>
        </CardHeader>
        <CardContent>
          <SearchBar onSearch={handleSearch} />
        </CardContent>
      </Card>
    </div>
  );
}
