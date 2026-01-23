import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { DRAMS, NAV, SPACING, TYPOGRAPHY, TRANSITIONS } from '@drams-design/components';
import { RollingSearch } from '@drams-design/components';
import { useAuth } from './hooks';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SearchPage } from './pages/SearchPage';
import { ResultsPage } from './pages/ResultsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AgentChatPage } from './pages/AgentChatPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { LoginPage } from './pages/LoginPage';

// DRAMS: Clean white background, minimal chrome
const APP_CONTAINER_STYLE = {
  width: '100%',
  height: '100vh',
  backgroundColor: '#ffffff',
  fontFamily: DRAMS.fontFamily,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
};

// DRAMS: Unobtrusive header with soft shadow
const HEADER_STYLE = {
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  padding: '0 80px',
  position: 'sticky' as const,
  top: 0,
  zIndex: 10,
};

const HEADER_CONTENT_STYLE = {
  maxWidth: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: '64px',
};

// DRAMS: Bold, clean logo with Sacramento cursive font
const LOGO_STYLE = {
  fontSize: '36px',
  fontFamily: "'Sacramento', cursive",
  color: DRAMS.textDark,
  textDecoration: 'none',
  transition: TRANSITIONS.hover,
  fontWeight: 'normal',
};

const NAV_STYLE = {
  display: 'flex',
  gap: SPACING.sm,
  alignItems: 'center',
};

// DRAMS: Navigation link with built-in hover states using CSS
const NAV_LINK_CLASS = 'drams-nav-link';

// Inject CSS for nav link hover states
const NAV_STYLES = `
  .${NAV_LINK_CLASS} {
    padding: ${SPACING.sm} ${SPACING.lg};
    border-radius: 48px;
    text-decoration: none;
    color: ${DRAMS.textDark};
    ${TYPOGRAPHY.body}
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .${NAV_LINK_CLASS}:hover:not(.${NAV_LINK_CLASS}-active) {
    background: ${DRAMS.grayTrack};
  }
  .${NAV_LINK_CLASS}-active {
    background: ${DRAMS.orange};
    color: white;
  }
`;

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const isActivePath = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleSearch = (query: string) => {
    navigate(`/results?category=grocery&q=${encodeURIComponent(query)}`);
  };

  return (
    <>
      <style>{NAV_STYLES}</style>
      <div style={APP_CONTAINER_STYLE}>
        <header style={HEADER_STYLE}>
          <div style={HEADER_CONTENT_STYLE}>
            <Link to="/" style={LOGO_STYLE}>
              Ondc Buyer
            </Link>
            <nav style={NAV_STYLE}>
              {[
                { path: '/search', label: 'Search' },
                { path: '/cart', label: 'Cart' },
                { path: '/orders', label: 'Orders' },
                { path: '/agent', label: 'Agent' },
              ].map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`${NAV_LINK_CLASS} ${isActivePath(path) ? `${NAV_LINK_CLASS}-active` : ''}`}
                >
                  {label}
                </Link>
              ))}
              <RollingSearch onSearch={handleSearch} />

              {/* Auth section with wallet connection */}
              <div style={{ display: 'flex', gap: SPACING.sm, alignItems: 'center' }}>
                {isAuthenticated && user ? (
                  <Link
                    to="/orders"
                    className={NAV_LINK_CLASS}
                    style={{ ...TYPOGRAPHY.bodySmall, color: DRAMS.textLight }}
                  >
                    {user.wallet_address.slice(0, 6)}...
                  </Link>
                ) : null}
                <WalletMultiButton
                  style={{
                    backgroundColor: isAuthenticated ? DRAMS.grayTrack : DRAMS.orange,
                    borderRadius: '48px',
                    ...TYPOGRAPHY.bodySmall,
                  }}
                />
              </div>
            </nav>
          </div>
        </header>
        <main style={{ flex: 1, overflow: 'auto', overflowY: 'auto', paddingBottom: SPACING.xl }}>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/agent" element={<AgentChatPage />} />
            {/* Protected routes - require authentication */}
            <Route path="/cart" element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            } />
            <Route path="/checkout" element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/orders/:id" element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            } />
            {/* Login page - redirect if already authenticated */}
            <Route path="/login" element={
              <ProtectedRoute requireAuth={false}>
                <LoginPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
