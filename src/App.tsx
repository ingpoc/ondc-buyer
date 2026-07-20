import { FormEvent, Fragment, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, ChevronDown, Menu, Search, ShieldAlert, ShieldCheck, ShieldX, UserRound } from 'lucide-react';
import { useAgentRuntime, useSubject, useTrustState } from './hooks';
import { SearchPage } from './pages/SearchPage';
import { ResultsPage } from './pages/ResultsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { BuyerConfigPage } from './pages/BuyerConfigPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { SamanthaOrb } from './components/SamanthaOrb';
import { Button } from './components/ui/button';
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
import { effectiveElevatedTrustState, type PortfolioTrustState } from './lib/trust';
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

/** Persistent shop destinations when signed in. */
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: '/search', label: 'Search' },
  { href: '/cart', label: 'Cart' },
  { href: '/orders', label: 'Orders' },
  { href: '/config', label: 'Preferences' },
];

/** Guests land on Search already — no lone redundant nav pill. */
const GUEST_NAV_ITEMS: NavItem[] = [];

type HeaderControl = 'search' | 'account' | null;

export function headerTrustIsHealthy(label: string): boolean {
  return label === 'Trust verified';
}

export function headerRuntimeIsHealthy(label: string): boolean {
  return label === 'Ready';
}

export function getTrustMeta(state: PortfolioTrustState, loading?: boolean) {
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

/** Session principals (Auth0/demo) skip hangar wallet KYC — treat as verified in chrome. */
export function getHeaderTrustMeta(
  state: PortfolioTrustState,
  loading: boolean,
  principalId?: string | null,
) {
  return getTrustMeta(effectiveElevatedTrustState(state, principalId), loading);
}

function useBuyerHeaderAuthority() {
  const { walletAddress, subjectId, principalId } = useSubject();
  const trust = useTrustState(walletAddress);
  const runtime = useAgentRuntime(subjectId, walletAddress);
  const trustMeta = getHeaderTrustMeta(trust.state, trust.loading, principalId);
  const runtimeMeta = getRuntimeMeta(runtime);
  return { trustMeta, runtimeMeta };
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

function getRuntimeMeta(runtime: {
  loading?: boolean;
  runtime_available: boolean;
  blocked_reason?: string | null;
}) {
  if (runtime.loading) {
    return {
      label: 'Checking',
      detail: 'Checking whether Samantha can run long tasks.',
      className: 'bg-secondary text-secondary-foreground',
      icon: Bot,
    };
  }
  if (runtime.runtime_available) {
    return {
      label: 'Ready',
      detail: 'Samantha can run longer shopping tasks for you.',
      className: 'bg-primary/12 text-primary',
      icon: Bot,
    };
  }
  return {
    label: 'Unavailable',
    detail: runtime.blocked_reason || 'Longer Samantha tasks are unavailable right now.',
    className: 'bg-accent text-accent-foreground',
    icon: Bot,
  };
}

/** Healthy Ready / Trust verified stay out of the bar. */
function HeaderAttentionBadge() {
  const { trustMeta, runtimeMeta } = useBuyerHeaderAuthority();
  if (trustMeta.label === 'Trust loading' || runtimeMeta.label === 'Checking') return null;
  if (headerTrustIsHealthy(trustMeta.label) && headerRuntimeIsHealthy(runtimeMeta.label)) {
    return null;
  }

  const preferTrust = !headerTrustIsHealthy(trustMeta.label);
  const href = '/config';
  const label = preferTrust
    ? `Trust: ${trustMeta.label.replace(/^Trust /, '')}`
    : `Assistant: ${runtimeMeta.label}`;
  const Icon = preferTrust ? trustMeta.icon : runtimeMeta.icon;
  const detail = preferTrust ? trustMeta.detail : runtimeMeta.detail;
  const className = preferTrust ? trustMeta.className : runtimeMeta.className;

  return (
    <Link
      to={href}
      title={detail}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

function AccountMenu({
  open,
  onOpenChange,
  onLogout,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const { trustMeta, runtimeMeta } = useBuyerHeaderAuthority();
  const TrustIcon = trustMeta.icon;
  const panelId = 'buyer-account-menu';

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full shadow-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        <UserRound className="size-4" aria-hidden />
        <span>Account</span>
        <ChevronDown
          className={cn('size-3.5 opacity-70 transition', open && 'rotate-180')}
          aria-hidden
        />
      </Button>
      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-background p-3 shadow-lg"
        >
          <div className="space-y-2 border-b border-border/60 pb-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Trust
            </p>
            <div className="flex items-start gap-2 text-foreground">
              <TrustIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">{trustMeta.label.replace(/^Trust /, '')}</p>
                <p className="text-xs text-muted-foreground">{trustMeta.detail}</p>
              </div>
            </div>
            <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assistant
            </p>
            <div className="flex items-start gap-2 text-foreground">
              <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">{runtimeMeta.label}</p>
                <p className="text-xs text-muted-foreground">{runtimeMeta.detail}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <Link
              role="menuitem"
              to="/config"
              className="rounded-xl px-3 py-2 text-sm hover:bg-secondary"
              onClick={() => {
                onOpenChange(false);
                onNavigate?.();
              }}
            >
              Preferences &amp; mandate
            </Link>
            <Button
              type="button"
              role="menuitem"
              variant="ghost"
              className="justify-start rounded-xl px-3"
              onClick={() => {
                onOpenChange(false);
                onLogout();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountPanelCompact({
  onLogout,
  onNavigate,
}: {
  onLogout: () => void;
  onNavigate: () => void;
}) {
  const { trustMeta, runtimeMeta } = useBuyerHeaderAuthority();
  const TrustIcon = trustMeta.icon;

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <TrustIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">Trust · {trustMeta.label.replace(/^Trust /, '')}</p>
            <p className="text-xs text-muted-foreground">{trustMeta.detail}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">Assistant · {runtimeMeta.label}</p>
            <p className="text-xs text-muted-foreground">{runtimeMeta.detail}</p>
          </div>
        </div>
      </div>
      <NavigationLink
        href="/config"
        label="Preferences & mandate"
        active={false}
        onNavigate={onNavigate}
      />
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onLogout}>
        Sign out
      </Button>
    </div>
  );
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    loading: authLoading,
    error: authError,
    loginAuth0,
    loginGoogle,
    logout,
  } = useAuthContext();
  const authProviders = useAuthProviders();
  const activePath = getActivePath(location.pathname);
  const visibleNavItems = isAuthenticated ? PRIMARY_NAV_ITEMS : GUEST_NAV_ITEMS;
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
                      {isAuthenticated
                        ? `Shop on ${COMMERCE_EXCHANGE_LABEL}. Account tools are below.`
                        : `Browse ${COMMERCE_EXCHANGE_LABEL}. Sign in to checkout.`}
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
                    {IDENTITY_AUTH_ENABLED && !authLoading ? (
                      isAuthenticated ? (
                        <AccountPanelCompact
                          onLogout={() => void logout()}
                          onNavigate={() => undefined}
                        />
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
                {isAuthenticated ? 'Search, cart, and orders' : 'Sign in to checkout'}
              </div>
            </Link>
          </div>

          {visibleNavItems.length > 0 ? (
            <div className="hidden flex-1 justify-center lg:flex">
              <nav aria-label="Primary buyer navigation" className="nav-track">
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
            </div>
          ) : (
            <div className="hidden flex-1 lg:block" />
          )}

          <div
            ref={headerControlsRef}
            className={cn(
              'ml-auto flex min-w-0 items-center justify-end gap-2',
              activeHeaderControl === 'search' ? 'xl:flex-1' : '',
            )}
          >
            <HeaderSearch
              onSearch={handleSearch}
              expanded={activeHeaderControl === 'search'}
              onExpand={() => setActiveHeaderControl('search')}
              onCollapse={() => setActiveHeaderControl(null)}
              className={cn(
                'hidden xl:inline-flex',
                activeHeaderControl === 'search'
                  ? 'xl:min-w-0 xl:flex-1 xl:max-w-[32vw]'
                  : '',
              )}
            />
            {isAuthenticated ? (
              <>
                <HeaderAttentionBadge />
                <AccountMenu
                  open={activeHeaderControl === 'account'}
                  onOpenChange={(next) => setActiveHeaderControl(next ? 'account' : null)}
                  onLogout={() => void logout()}
                />
              </>
            ) : null}
            {IDENTITY_AUTH_ENABLED && !authLoading && !isAuthenticated ? (
              <div className="flex min-w-0 flex-col items-end gap-1">
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
                {authError ? (
                  <p className="max-w-[14rem] text-right text-[11px] leading-snug text-destructive">
                    {authError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-32 pt-8 sm:px-6 sm:pb-8">
        <Routes>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/config" element={<BuyerConfigPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </main>
      {isAuthenticated ? <SamanthaOrb /> : null}
    </Fragment>
  );
}
