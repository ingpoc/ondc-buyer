import { FormEvent, Fragment, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, ChevronRight, Menu, Search, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAgentRuntime, useSubject, useTrustState } from './hooks';
import { SearchPage } from './pages/SearchPage';
import { ResultsPage } from './pages/ResultsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AgentChatPage } from './pages/AgentChatPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { Button, buttonVariants } from './components/ui/button';
import {
  ButtonGroup,
  ButtonGroupText,
} from './components/ui/button-group';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from './components/ui/input-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/ui/sheet';
import { normalizeLoopbackUrl } from './lib/loopback';
import type { PortfolioTrustState } from './lib/trust';
import { cn } from './lib/utils';

const NAV_ITEMS = [
  { href: '/search', label: 'Search' },
  { href: '/cart', label: 'Cart' },
  { href: '/orders', label: 'Orders' },
  { href: '/agent', label: 'Agent' },
] as const;

const IDENTITY_WEB_URL = normalizeLoopbackUrl(
  import.meta.env.VITE_IDENTITY_WEB_URL || 'http://127.0.0.1:43100',
);

const WALLET_BUTTON_STYLE = {
  backgroundColor: 'var(--primary)',
  color: 'var(--primary-foreground)',
  borderRadius: '999px',
  boxShadow: 'var(--wallet-shadow)',
  height: '40px',
  padding: '0 16px',
  fontSize: '0.875rem',
  fontWeight: 600,
};

type HeaderControl = 'search' | 'runtime' | 'trust' | null;

function getTrustMeta(state: PortfolioTrustState, loading?: boolean) {
  if (loading) {
    return {
      label: 'Trust loading',
      detail: 'Checking AadhaarChain before enabling elevated buyer actions.',
      className: 'bg-secondary text-secondary-foreground',
      icon: ShieldAlert,
    };
  }

  switch (state) {
    case 'verified':
      return {
        label: 'Trust verified',
        detail: 'AadhaarChain verification is complete for elevated buyer actions.',
        className: 'bg-primary/12 text-primary',
        icon: ShieldCheck,
      };
    case 'revoked_or_blocked':
      return {
        label: 'Trust blocked',
        detail: 'AadhaarChain is blocking elevated buyer actions until the issue is resolved.',
        className: 'bg-destructive/10 text-destructive',
        icon: ShieldX,
      };
    case 'identity_present_unverified':
      return {
        label: 'Trust unverified',
        detail: 'Identity exists, but AadhaarChain verification is not complete yet.',
        className: 'bg-secondary text-secondary-foreground',
        icon: ShieldAlert,
      };
    case 'manual_review':
      return {
        label: 'Trust review',
        detail: 'AadhaarChain has the identity under manual review.',
        className: 'bg-secondary text-secondary-foreground',
        icon: ShieldAlert,
      };
    default:
      return {
        label: 'No identity',
        detail: 'Connect a wallet-backed identity before attempting elevated buyer actions.',
        className: 'bg-secondary text-secondary-foreground',
        icon: ShieldAlert,
      };
  }
}

function getActivePath(pathname: string): string {
  if (
    pathname === '/' ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/results') ||
    pathname.startsWith('/product')
  ) {
    return '/search';
  }
  if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) {
    return '/cart';
  }
  if (pathname.startsWith('/orders')) {
    return '/orders';
  }
  if (pathname.startsWith('/agent')) {
    return '/agent';
  }
  return '/search';
}

function NavigationLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={href}
      onClick={onNavigate}
      className={cn(
        buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm' }),
        'rounded-full',
      )}
    >
      {label}
    </Link>
  );
}

function HeaderSearch({
  onSearch,
  expanded = false,
  onExpand,
  onCollapse,
  className,
}: {
  onSearch: (query: string) => void;
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [expanded]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSearch(String(formData.get('query') || '').trim());
    onCollapse?.();
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={cn('rounded-full shadow-sm', className)}
        onClick={onExpand}
        aria-label="Open search"
      >
        <Search className="size-4" />
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <label htmlFor="header-search-query" className="sr-only">
        Search the network
      </label>
      <InputGroup className="h-10 bg-background">
        <InputGroupAddon>
          <InputGroupText>
            <Search className="size-4" />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="header-search-query"
          ref={inputRef}
          name="query"
          placeholder="Search the network..."
          aria-label="Search the network"
          className="text-[14px] md:text-[14px] placeholder:text-[14px]"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onCollapse?.();
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" size="sm">
            Search
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

function HeaderStatusRail({
  subjectId,
  walletAddress,
  runtime,
  trust,
  activeControl,
  onToggle,
}: {
  subjectId: string | null;
  walletAddress: string | null;
  runtime: ReturnType<typeof useAgentRuntime>;
  trust: ReturnType<typeof useTrustState>;
  activeControl: HeaderControl;
  onToggle: (control: Exclude<HeaderControl, null>) => void;
}) {
  const showRuntime = Boolean(subjectId);
  const showTrust = Boolean(walletAddress);

  if (!showRuntime && !showTrust) {
    return null;
  }

  const trustMeta = getTrustMeta(trust.state, trust.loading);
  const TrustIcon = trustMeta.icon;
  const runtimeDetail = runtime.loading
    ? 'Checking the buyer runtime.'
    : runtime.runtime_available
      ? `Buyer runtime ready via ${runtime.auth_mode}.`
      : runtime.blocked_reason || 'Buyer runtime is unavailable.';
  const runtimeExpanded = activeControl === 'runtime';
  const trustExpanded = activeControl === 'trust';

  return (
    <div className="hidden xl:flex items-center gap-2">
      {showRuntime ? (
        runtimeExpanded ? (
          <ButtonGroup className="rounded-full border border-border/70 bg-background/90 px-1 shadow-sm backdrop-blur">
            <ButtonGroupText
              className="rounded-full border-0 bg-transparent px-3 text-xs text-muted-foreground"
              title={runtimeDetail}
            >
              <Bot className="size-3.5" />
              <span>Runtime</span>
              <span className="font-medium text-foreground">
                {runtime.loading ? 'Loading' : runtime.auth_mode}
              </span>
            </ButtonGroupText>
          </ButtonGroup>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-full shadow-sm"
            title={runtimeDetail}
            aria-label="Open runtime status"
            onClick={() => onToggle('runtime')}
          >
            <Bot className="size-4" />
          </Button>
        )
      ) : null}

      {showTrust ? (
        trustExpanded ? (
          <ButtonGroup className="rounded-full border border-border/70 bg-background/90 px-1 shadow-sm backdrop-blur">
            <ButtonGroupText
              asChild
              className={cn('rounded-full border-0 px-3 text-xs', trustMeta.className)}
            >
              <a href={`${IDENTITY_WEB_URL}/dashboard`} title={trustMeta.detail}>
                <TrustIcon className="size-3.5" />
                <span>Trust</span>
                <span className="font-medium">{trustMeta.label.replace(/^Trust /, '')}</span>
                <ChevronRight className="size-3.5 opacity-70" />
              </a>
            </ButtonGroupText>
          </ButtonGroup>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn('rounded-full shadow-sm', trustMeta.className)}
            title={trustMeta.detail}
            aria-label="Open trust status"
            onClick={() => onToggle('trust')}
          >
            <TrustIcon className="size-4" />
          </Button>
        )
      ) : null}
    </div>
  );
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { walletAddress, subjectId } = useSubject();
  const trust = useTrustState(walletAddress);
  const runtime = useAgentRuntime(subjectId, walletAddress);
  const activePath = getActivePath(location.pathname);
  const [activeHeaderControl, setActiveHeaderControl] = useState<HeaderControl>(null);
  const headerControlsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeHeaderControl) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!headerControlsRef.current?.contains(event.target as Node)) {
        setActiveHeaderControl(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [activeHeaderControl]);

  const handleSearch = (query: string) => {
    navigate(`/results?category=grocery&q=${encodeURIComponent(query)}`);
  };

  const toggleHeaderControl = (control: Exclude<HeaderControl, null>) => {
    setActiveHeaderControl((current) => (current === control ? null : control));
  };

  return (
    <Fragment>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon-sm" className="rounded-full">
                    <Menu className="size-4" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>ONDC Buyer</SheetTitle>
                    <SheetDescription>
                      Trust-aware buyer shell for discovery, cart, and checkout flows.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 px-6 pb-6">
                    <HeaderSearch onSearch={handleSearch} expanded />
                    <div className="grid gap-2">
                      {NAV_ITEMS.map((item) => (
                        <NavigationLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          active={activePath === item.href}
                        />
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <Link to="/search" className="space-y-0.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Portfolio
              </div>
              <div className="text-xl font-semibold tracking-tight">ONDC Buyer</div>
              <div className="hidden text-sm text-muted-foreground sm:block">
                Discover verified commerce with a faster trust-aware shell.
              </div>
            </Link>
          </div>

          <nav
            className={cn(
              'hidden items-center gap-1 lg:flex',
              activeHeaderControl
                ? 'xl:flex-1 xl:min-w-0 xl:pl-4'
                : 'lg:flex-1 lg:justify-center xl:pr-4',
            )}
          >
            {NAV_ITEMS.map((item) => (
              <NavigationLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={activePath === item.href}
              />
            ))}
          </nav>

          <div
            ref={headerControlsRef}
            className={cn(
              'ml-auto flex min-w-0 items-center justify-end gap-2',
              activeHeaderControl ? 'xl:flex-1' : '',
            )}
          >
            <HeaderSearch
              onSearch={handleSearch}
              expanded={activeHeaderControl === 'search'}
              onExpand={() => toggleHeaderControl('search')}
              onCollapse={() => setActiveHeaderControl(null)}
              className={cn(
                'hidden xl:inline-flex',
                activeHeaderControl === 'search'
                  ? 'xl:min-w-0 xl:flex-1 xl:max-w-[32vw]'
                  : '',
              )}
            />
            <HeaderStatusRail
              subjectId={subjectId}
              walletAddress={walletAddress}
              runtime={runtime}
              trust={trust}
              activeControl={activeHeaderControl}
              onToggle={toggleHeaderControl}
            />
            <WalletMultiButton style={WALLET_BUTTON_STYLE} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/agent" element={<AgentChatPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </Fragment>
  );
}
