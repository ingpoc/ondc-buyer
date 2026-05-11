/**
 * AUTH-COMPOSITION: producer=aadhaar-chain
 * AUTH-COMPOSITION: deployed_public_mode=compatibility_probe_only
 * AUTH-COMPOSITION: local_dev_mode=identity_session_experiment
 *
 * Identity-session compatibility client:
 * - local and explicitly configured dev flows may exercise AadhaarChain identity sessions
 * - deployed public behavior must not claim a working shared AadhaarChain session broker
 * - trust-state consumption stays separate from auth composition
 *
 * Compatibility endpoints:
 * - POST /api/auth/login - request a session when the identity provider enables it
 * - GET /api/auth/me - read current user when an identity session exists
 * - GET /api/auth/validate - validate an existing identity session
 * - POST /api/auth/logout - revoke an existing identity session
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { LoginResult, SessionValidationResult, SSOUser } from '@portfolio/trust-client';
import { COMMERCE_API_BASE } from './commerceConfig';
import { IDENTITY_URL, IDENTITY_WEB_URL } from './identityUrls';

// Current authenticated user's wallet address
let currentWalletAddress: string | null = null;

export type { LoginResult, SessionValidationResult, SSOUser };

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
  baseURL: COMMERCE_API_BASE || undefined,
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
 * Login with wallet address when the identity-session surface is active
 * POST /api/auth/login
 *
 * Requests an identity session and sets a cookie when supported by the producer
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
  } catch {
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
 * Logout from identity session
 * POST /api/auth/logout
 *
 * Revokes the session and clears the cookie when present
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
 * Record app access for identity-session analytics
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
export { COMMERCE_API_BASE as API_BASE, IDENTITY_URL };
