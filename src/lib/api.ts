/**
 * SSO-002: API Client with Aadharcha.in SSO Session Support
 *
 * Wallet-based SSO integration:
 * - Uses Solana wallet address as user ID
 * - Cookie-based session (aadharcha_session)
 * - Session validation via /api/auth/validate
 * - Auto-redirect to identity provider on 401
 *
 * Aadharcha.in SSO Endpoints:
 * - POST /api/auth/login - Create session with wallet_address
 * - GET /api/auth/me - Get current user (401 if not authenticated)
 * - GET /api/auth/validate - Validate session (returns valid: boolean)
 * - POST /api/auth/logout - Revoke session and clear cookie
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://aadharcha.in';
// Login page URL (frontend) - separate from API gateway
const IDENTITY_WEB_URL = import.meta.env.VITE_IDENTITY_WEB_URL || IDENTITY_URL;
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Current authenticated user's wallet address
let currentWalletAddress: string | null = null;

/**
 * User type from Aadharcha SSO
 */
export interface SSOUser {
  wallet_address: string;
  pda_address?: string;
  owner_pubkey?: string;
  created_at: number;
}

/**
 * Session validation response
 */
export interface SessionValidationResult {
  valid: boolean;
  user?: SSOUser;
}

/**
 * Login response
 */
export interface LoginResult {
  user: SSOUser;
  session: {
    session_id: number;
    created_at: number;
    last_active: number;
    expires_at: number;
  };
}

/**
 * Create configured Axios instance for identity service
 */
export const identityClient: AxiosInstance = axios.create({
  baseURL: `${IDENTITY_URL}/api`,
  withCredentials: true, // CRITICAL: Include aadharcha_session cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Create configured Axios instance for backend API
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - add wallet address as X-User-ID header
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (currentWalletAddress) {
      config.headers = config.headers || {};
      config.headers['X-User-ID'] = currentWalletAddress;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor - redirect to login on 401
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Session expired or invalid - redirect to login
      const currentPath = window.location.pathname;
      // Don't redirect if already on login page
      if (currentPath !== '/login') {
        const returnUrl = encodeURIComponent(`${window.location.origin}${currentPath}`);
        window.location.href = `${IDENTITY_URL}/login?return=${returnUrl}`;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Login with wallet address
 * POST /api/auth/login
 *
 * Creates SSO session and sets aadharcha_session cookie
 */
export async function loginWithWallet(walletAddress: string): Promise<LoginResult> {
  const response = await identityClient.post<LoginResult>('/auth/login', {
    wallet_address: walletAddress,
  });

  const result = response.data;
  if (result.user) {
    currentWalletAddress = result.user.wallet_address;
  }

  return result;
}

/**
 * Validate session
 * GET /api/auth/validate
 *
 * Returns { valid: boolean, user?: SSOUser }
 * Use this for non-blocking validation (doesn't throw on 401)
 */
export async function validateSession(): Promise<SessionValidationResult> {
  try {
    const response = await identityClient.get<{ valid: boolean; user?: SSOUser }>('/auth/validate');
    const result = response.data;

    if (result.valid && result.user) {
      currentWalletAddress = result.user.wallet_address;
      return { valid: true, user: result.user };
    }

    currentWalletAddress = null;
    return { valid: false };
  } catch (error) {
    currentWalletAddress = null;
    return { valid: false };
  }
}

/**
 * Get current authenticated user
 * GET /api/auth/me
 *
 * Throws 401 if not authenticated
 * Use this when user must be logged in
 */
export async function getCurrentUser(): Promise<SSOUser> {
  const response = await identityClient.get<{ data: SSOUser }>('/auth/me');
  const user = response.data.data;

  if (user) {
    currentWalletAddress = user.wallet_address;
  }

  return user;
}

/**
 * Logout from SSO
 * POST /api/auth/logout
 *
 * Revokes session and clears cookie
 */
export async function logout(): Promise<void> {
  try {
    await identityClient.post('/auth/logout', {});
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    currentWalletAddress = null;
    // Redirect to home after logout
    window.location.href = '/';
  }
}

/**
 * Get current wallet address from session
 */
export function getCurrentWalletAddress(): string | null {
  return currentWalletAddress;
}

/**
 * Check if user is authenticated (non-blocking)
 */
export function isAuthenticated(): boolean {
  return currentWalletAddress !== null;
}

/**
 * Redirect to identity provider login page
 */
export function redirectToLogin(returnPath: string = window.location.pathname): void {
  const returnUrl = encodeURIComponent(`${window.location.origin}${returnPath}`);
  // Use IDENTITY_WEB_URL for login page (frontend), not gateway
  window.location.href = `${IDENTITY_WEB_URL}/login?return=${returnUrl}`;
}

/**
 * Record app access for SSO analytics
 * POST /api/auth/apps/{app_name}/access
 *
 * Call this when user successfully accesses your app
 */
export async function recordAppAccess(appName: string): Promise<void> {
  try {
    await identityClient.post(`/auth/apps/${appName}/access`, {});
  } catch (error) {
    console.warn('Failed to record app access:', error);
  }
}

// Export base URLs
export { API_BASE, IDENTITY_URL };
