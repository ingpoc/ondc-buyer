import { FormEvent, Fragment, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, Menu, Search, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { useAgentRuntime, useSubject, useTrustState } from './hooks';
import { SearchPage } from './pages/SearchPage';
import { ResultsPage } from './pages/ResultsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AgentChatPage } from './pages/AgentChatPage';
import { BuyerConfigPage } from './pages/BuyerConfigPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { SamanthaOrb } from './components/SamanthaOrb';
import { Button } from './components/ui/button';
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
import type { PortfolioTrustState } from './lib/trust';
import { cn } from './lib/utils';
import { useAuthContext } from './contexts/AuthContext';
import { useAuthProviders } from './lib/authProviders';
import { COMMERCE_EXCHANGE_LABEL } from './lib/commerceConfig';

const IDENTITY_AUTH_ENABLED = import.meta.env.VITE_IDENTITY_AUTH_ENABLED === 'true';

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/agent', label: 'Ask Samantha' },
  { href: '/search', label: 'Search' },
  { href: '/cart', label: 'Cart' },
  { href: '/orders', label: 'Orders' },
  { href: '/config', label: 'Preferences' },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: '/usecase.html#agents', label: 'How it works', external: true },
];


type HeaderControl = 'search' | 'runtime' | 'trust' | null;

function getTrustMeta(state: PortfolioTrustState, loading?: boolean) {
  if (loading) {
    return {
      label: 'Trust loading',
      detail: 'Checking session trust before enabling elevated buyer actions.',
      className: 'bg-secondary text-secondary-foreground',
      icon: ShieldAlert,
    };
  }

  switch (state) {
    case 'verified':
      return {
        label: 'Trust verified',
        detail: 'Session trust is ready for elevated buyer actions.',
        className: 'bg-primary/12 text-primary',
        icon: ShieldCheck,
      };
    case 'revoked_or_blocked':
      return {
        label: 'Trust blocked',
        detail: 'Elevated buyer actions are blocked until the trust issue is resolved.',
        className: 'bg-destructive/10 text-destructive',
        icon: ShieldX,
      };
    case 'identity_present_unverified':
      return {
        label: 'Trust unverified',
        detail: 'Identity exists, but verification is not complete yet.',
        className: 'bg-secondary text-secondary-foreground',
        icon: ShieldAlert,
      };
    case 'manual_review':
      return {
        label: 'Trust review',
        detail: 'Identity is under manual review.',
        className: 'bg-secondary text-secondary-foreground',
        icon: ShieldAlert,
      };
    default:
      return {
        label: 'Sign in required',
        detail: 'Sign in before elevated buyer actions.',
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
  if (pathname.startsWith('/config')) {
    return '/config';
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
  external,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} onClick={onNavigate} className="nav-pill" data-active="false">
        {label}
      </a>
    );
  }

  return (
    <Link to={href} onClick={onNavigate} className="nav-pill" data-active={active ? 'true' : 'false'}>
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
    const query = String(formData.get('query') ?? '').trim();
    onSearch(query);
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

export function HeaderStatusRail({
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
              className={cn('rounded-full border-0 px-3 text-xs', trustMeta.className)}
              title={trustMeta.detail}
            >
              <TrustIcon className="size-3.5" />
              <span>Trust</span>
              <span className="font-medium">{trustMeta.label.replace(/^Trust /, '')}</span>
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
  const {
    isAuthenticated,
    loading: authLoading,
    loginAuth0,
    loginGoogle,
    logout,
  } = useAuthContext();
  const authProviders = useAuthProviders();
  const trust = useTrustState(walletAddress);
  const runtime = useAgentRuntime(subjectId, walletAddress);
  const activePath = getActivePath(location.pathname);
  const visibleNavItems = isAuthenticated
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.href !== '/agent');
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  const handleSearch = (query?: string) => {
    const normalized = String(query ?? '').trim();
    navigate(`/results?category=grocery&q=${encodeURIComponent(normalized)}`);
  };

  const toggleHeaderControl = (control: Exclude<HeaderControl, null>) => {
    setActiveHeaderControl((current) => (current === control ? null : control));
  };

  return (
    <Fragment>
      <header className="shell-header">
        <div className="shell-inner">
          <div className="flex min-w-0 items-center gap-3">
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
                      Agent-led shopping under AgentGuard ({COMMERCE_EXCHANGE_LABEL}).
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-col gap-4 px-6 pb-6">
                    <HeaderSearch onSearch={handleSearch} expanded />
                    <div className="flex flex-col gap-2">
                      {visibleNavItems.map((item) => (
                        <NavigationLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          active={activePath === item.href}
                          external={item.external}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
                      {SECONDARY_NAV_ITEMS.map((item) => (
                        <NavigationLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          active={activePath === item.href}
                          external={item.external}
                        />
                      ))}
                    </div>
                    {IDENTITY_AUTH_ENABLED && !authLoading ? (
                      isAuthenticated ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-full"
                          onClick={() => void logout()}
                        >
                          Sign out
                        </Button>
                      ) : (
                        <div className="grid gap-2">
                          {authProviders.auth0 ? (
                            <Button
                              type="button"
                              className="w-full rounded-full"
                              onClick={() => loginAuth0(location.pathname)}
                            >
                              Sign in
                            </Button>
                          ) : null}
                          {!authProviders.auth0 && authProviders.google ? (
                            <Button
                              type="button"
                              className="w-full rounded-full"
                              onClick={() => loginGoogle(location.pathname)}
                            >
                              Continue with Google
                            </Button>
                          ) : null}
                          {!authProviders.loading &&
                          !authProviders.auth0 &&
                          !authProviders.google ? (
                            <p className="text-sm text-muted-foreground">
                              Sign-in is not configured on the gateway.
                            </p>
                          ) : null}
                        </div>
                      )
                    ) : null}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <Link to="/search" className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                ONDC Buyer
              </div>
              <div className="hidden text-xs text-muted-foreground sm:block">
                Shop across verified network sellers
              </div>
            </Link>
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-1.5 lg:flex">
            {visibleNavItems.map((item) => (
              <NavigationLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={activePath === item.href}
                external={item.external}
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
            {IDENTITY_AUTH_ENABLED && !authLoading ? (
              isAuthenticated ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => void logout()}
                >
                  Sign out
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {authProviders.auth0 ? (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full"
                      onClick={() => loginAuth0(location.pathname)}
                    >
                      Sign in
                    </Button>
                  ) : null}
                  {!authProviders.auth0 && authProviders.google ? (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full"
                      onClick={() => loginGoogle(location.pathname)}
                    >
                      Google
                    </Button>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
        <Routes>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route
            path="/agent"
            element={isAuthenticated ? <AgentChatPage /> : <Navigate to="/search" replace />}
          />
          <Route path="/config" element={<BuyerConfigPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
        <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-border/60 py-6 text-sm text-muted-foreground">
          {SECONDARY_NAV_ITEMS.map((item) => (
            <NavigationLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={activePath === item.href}
              external={item.external}
            />
          ))}
        </footer>
      </main>
      {isAuthenticated ? <SamanthaOrb /> : null}
    </Fragment>
  );
}
