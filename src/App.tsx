import { Fragment } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AppShell, Badge, RollingSearch, type NavItem } from '@portfolio-ui';
import { useAgentRuntime, useSubject, useTrustState } from './hooks';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SearchPage } from './pages/SearchPage';
import { ResultsPage } from './pages/ResultsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AgentChatPage } from './pages/AgentChatPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { TrustStatusChip } from './components/TrustStatus';

const NAV_ITEMS: NavItem[] = [
  { href: '/search', label: 'Search' },
  { href: '/cart', label: 'Cart' },
  { href: '/orders', label: 'Orders' },
  { href: '/agent', label: 'Agent' },
];

const WALLET_BUTTON_STYLE = {
  backgroundColor: 'var(--ui-primary)',
  borderRadius: '999px',
  boxShadow: '0 10px 24px rgba(234,106,42,0.24)',
  height: '44px',
  padding: '0 18px',
  fontSize: '0.875rem',
  fontWeight: 700,
};

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

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { walletAddress, subjectId } = useSubject();
  const trust = useTrustState(walletAddress);
  const runtime = useAgentRuntime(subjectId, walletAddress);

  const handleSearch = (query: string) => {
    navigate(`/results?category=grocery&q=${encodeURIComponent(query)}`);
  };

  return (
    <AppShell
      brand={{
        name: 'ONDC Buyer',
        href: '/search',
        tagline: 'Discover verified commerce with a faster trust-aware shell.',
      }}
      navItems={NAV_ITEMS}
      activePath={getActivePath(location.pathname)}
      renderLink={(item, className, isActive, onNavigate) => (
        <Link
          key={item.href}
          to={item.href}
          className={className}
          aria-current={isActive ? 'page' : undefined}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      )}
      headerSearch={<RollingSearch onSearch={handleSearch} />}
      actions={
        <Fragment>
          {subjectId ? (
            <Badge tone={runtime.runtime_available ? 'success' : 'warning'}>
              {runtime.loading ? 'Runtime loading' : `Runtime ${runtime.auth_mode}`}
            </Badge>
          ) : null}
          {walletAddress ? (
            <TrustStatusChip state={trust.state} loading={trust.loading} />
          ) : null}
          <WalletMultiButton style={WALLET_BUTTON_STYLE} />
        </Fragment>
      }
    >
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
    </AppShell>
  );
}
