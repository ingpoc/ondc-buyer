/**
 * SSO-005: Login Page Redirect
 *
 * Redirects to Aadharcha.in SSO login:
 * - /login page redirects to aadharcha.in/login
 * - Return URL parameter for redirect back to app
 * - Loading message while redirecting
 *
 * The actual login happens on aadharcha.in where users
 * connect their Solana wallet. After successful login,
 * the SSO cookie is set and users are redirected back here.
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout, DRAMS, SPACING, TYPOGRAPHY, PILL_BUTTON } from '@portfolio-ui';

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://aadharcha.in';

const LOADING_STYLE = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  gap: SPACING.xl,
  textAlign: 'center' as const,
};

const SPINNER_STYLE = {
  width: '48px',
  height: '48px',
  border: `4px solid ${DRAMS.grayTrack}`,
  borderTopColor: DRAMS.orange,
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const SPINNER_ANIMATION = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Get return URL from query params (set by SSO after login)
    const returnUrl = searchParams.get('return');

    if (returnUrl) {
      // User is returning from SSO login
      // Navigate to the return URL
      window.location.href = decodeURIComponent(returnUrl);
      return;
    }

    // No return URL means user accessed /login directly
    // Redirect to SSO login with return to current page
    const currentPath = window.location.pathname + window.location.search;
    const returnParam = encodeURIComponent(`${window.location.origin}${currentPath}`);
    const ssoLoginUrl = `${IDENTITY_URL}/login?return=${returnParam}`;

    window.location.href = ssoLoginUrl;
  }, [searchParams, navigate]);

  return (
    <>
      <style>{SPINNER_ANIMATION}</style>
      <PageLayout>
        <div style={LOADING_STYLE}>
          <div style={SPINNER_STYLE} />

          <div>
            <h1 style={{ ...TYPOGRAPHY.h1, color: DRAMS.textDark, margin: `0 0 ${SPACING.md} 0` }}>
              Connecting to Aadharcha.in
            </h1>
            <p style={{ ...TYPOGRAPHY.body, color: DRAMS.textLight, margin: `0 0 ${SPACING.xl} 0` }}>
              Please wait while we connect you to the secure login page...
            </p>
            <p style={{ ...TYPOGRAPHY.bodySmall, color: DRAMS.textLight }}>
              You'll be prompted to connect your Solana wallet to continue.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            style={PILL_BUTTON.orange}
          >
            Return to Home
          </button>
        </div>
      </PageLayout>
    </>
  );
}
