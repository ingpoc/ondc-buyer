import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncBuyerPrincipalSession } from '../lib/principalStorage';
import { CartPage } from './CartPage';
import { ResultsPage } from './ResultsPage';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  error: null as string | null,
}));

vi.mock('../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks')>();
  return {
    ...actual,
    useAuth: () => ({
      isAuthenticated: authState.isAuthenticated,
      error: authState.error,
    }),
    useSubject: () => ({ subjectId: null, principalId: null, walletAddress: null }),
    useTrustState: () => ({
      state: 'no_identity',
      loading: false,
      error: null,
      reason: null,
    }),
    useSearch: () => ({
      data: {
        items: [
          {
            id: 'atta-1',
            name: 'CF2 Browser Lifecycle Atta',
            price: { currency: 'INR', value: '89.00' },
            images: [],
            quantity: 12,
            provider: { name: 'Sunrise Foods' },
          },
        ],
        totalCount: 1,
      },
      loading: false,
      error: null,
      execute: vi.fn(),
    }),
  };
});

function renderShop() {
  return render(
    <MemoryRouter initialEntries={['/results?category=grocery&q=Atta']}>
      <Routes>
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/cart" element={<CartPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('guest cart survives /cart', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authState.isAuthenticated = false;
    authState.error = null;
  });

  it.each([
    { label: 'unsigned', error: null },
    {
      label: 'signed in for a different app',
      error: 'Signed in for a different app. Sign in again for Buyer.',
    },
  ])('keeps a $label add on /cart after auth revalidation', async ({ error }) => {
    authState.error = error;
    renderShop();

    fireEvent.click(screen.getByRole('button', { name: 'Add CF2 Browser Lifecycle Atta to cart' }));
    expect(
      await screen.findByText('CF2 Browser Lifecycle Atta added to cart. Sign in to check out.'),
    ).toBeInTheDocument();

    syncBuyerPrincipalSession(null);
    syncBuyerPrincipalSession(null);

    fireEvent.click(screen.getByRole('button', { name: 'View cart' }));
    await waitFor(() => {
      expect(screen.queryByText('Your cart is empty')).not.toBeInTheDocument();
    });
    expect(screen.getByText('CF2 Browser Lifecycle Atta')).toBeInTheDocument();
    expect(screen.getByText(/ready for trust-aware checkout/i)).toBeInTheDocument();
  });
});
