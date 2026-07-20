import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CartPage } from './CartPage';

vi.mock('../hooks', () => ({
  useSubject: () => ({ walletAddress: null, principalId: 'principal:demo:buyer' }),
  useTrustState: () => ({ state: 'verified', loading: false, error: null, reason: null }),
  useCart: () => ({
    session: null,
    loading: false,
    error: null,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    clearError: vi.fn(),
    itemCount: 0,
    subtotal: 0,
  }),
}));

describe('CartPage empty semantics', () => {
  it('retains a page heading and gives a useful recovery action', () => {
    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Shopping cart' })).toBeInTheDocument();
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start shopping' })).toBeInTheDocument();
  });
});
