import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultsPage } from './ResultsPage';

const addToCart = vi.fn();
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  error: null as string | null,
}));

vi.mock('../hooks', () => ({
  useCart: () => ({ addToCart, session: null }),
  useAuth: () => ({ isAuthenticated: authState.isAuthenticated, error: authState.error }),
  useSubject: () => ({ subjectId: null, principalId: null }),
  useSearch: () => ({
    data: {
      items: [
        {
          id: 'atta-1',
          name: 'Whole Wheat Atta 1kg',
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
}));

function renderResults() {
  return render(
    <MemoryRouter initialEntries={['/results?category=grocery&q=Atta']}>
      <ResultsPage />
    </MemoryRouter>,
  );
}

describe('guest add to cart', () => {
  beforeEach(() => {
    addToCart.mockReset();
    authState.isAuthenticated = false;
    authState.error = null;
  });

  it.each([
    { label: 'unsigned', error: null },
    { label: 'signed in for a different app', error: 'Signed in for a different app. Sign in again for Buyer.' },
  ])('does not show a success-added toast for a $label session unless the cart would contain the item', async ({ error }) => {
    authState.error = error;
    addToCart.mockResolvedValue({ items: [] });

    renderResults();
    fireEvent.click(screen.getByRole('button', { name: 'Add Whole Wheat Atta 1kg to cart' }));

    await waitFor(() => expect(addToCart).toHaveBeenCalled());
    expect(await screen.findByText('Sign in to add items and check out.')).toBeInTheDocument();
    expect(screen.queryByText(/added to cart/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View cart' })).not.toBeInTheDocument();
  });

  it('shows the guest checkout notice only after the cart store actually holds the item', async () => {
    addToCart.mockResolvedValue({
      items: [{ item: { id: 'atta-1', name: 'Whole Wheat Atta 1kg' } }],
    });

    renderResults();
    fireEvent.click(screen.getByRole('button', { name: 'Add Whole Wheat Atta 1kg to cart' }));

    await waitFor(() => expect(addToCart).toHaveBeenCalled());
    expect(
      await screen.findByText('Whole Wheat Atta 1kg added to cart. Sign in to check out.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View cart' })).toBeInTheDocument();
  });
});
