/**
 * SSO-003: Protected Route Wrapper
 *
 * Route wrapper that validates SSO session before rendering:
 * - Validates session before rendering child component
 * - Redirects to aadharcha.in/login if not authenticated
 * - Shows loading state during validation
 * - Supports return URL parameter for redirect back
 *
 * Usage:
 * ```tsx
 * <Route path="/checkout" element={
 *   <ProtectedRoute>
 *     <CheckoutPage />
 *   </ProtectedRoute>
 * } />
 * ```
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { DRAMS, SPACING, TYPOGRAPHY } from '@portfolio-ui';

const LOADING_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '50vh',
  color: DRAMS.textLight,
  ...TYPOGRAPHY.body,
};

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require authentication (default: true) */
  requireAuth?: boolean;
  /** Redirect to this path if not authenticated */
  redirectTo?: string;
}

/**
 * Protected Route Component
 *
 * Validates SSO session before rendering children.
 * If not authenticated, redirects to SSO login with return URL.
 */
export function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo,
}: ProtectedRouteProps): JSX.Element {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    // Allow a brief moment for session validation to complete
    const timer = setTimeout(() => {
      setIsValidating(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Show loading while validating session
  if (loading || isValidating) {
    return (
      <div style={LOADING_STYLE}>
        <div style={{ textAlign: 'center' }}>
          <p>Verifying session...</p>
          {isAuthenticated && (
            <p style={{ ...TYPOGRAPHY.bodySmall, color: DRAMS.textLight, marginTop: SPACING.sm }}>
              Logged in as {user?.wallet_address?.slice(0, 8)}...
            </p>
          )}
        </div>
      </div>
    );
  }

  // If authentication is required but user is not logged in
  if (requireAuth && !isAuthenticated) {
    // Use custom redirect or default to SSO login
    if (redirectTo) {
      return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
    }

    // Redirect to SSO login with return URL
    const currentPath = location.pathname;
    const returnUrl = encodeURIComponent(`${window.location.origin}${currentPath}`);
    const loginUrl = `${import.meta.env.VITE_IDENTITY_URL || 'https://aadharcha.in'}/login?return=${returnUrl}`;

    // Using window.location for full page reload (needed for SSO)
    window.location.href = loginUrl;

    // Show loading while redirecting
    return (
      <div style={LOADING_STYLE}>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  // If user is authenticated but shouldn't be (e.g., login page)
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Session is valid, render children
  return <>{children}</>;
}
