import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ResultsPage } from './ResultsPage';

const addToCart = vi.fn(async () => undefined);

vi.mock('../hooks', () => ({
  useCart: () => ({ addToCart, session: null }),
  useAuth: () => ({ isAuthenticated: false }),
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

describe('guest add to cart', () => {
  it('shows a sign-in notice instead of a silent no-op', async () => {
    render(
      <MemoryRouter initialEntries={['/results?category=grocery&q=Atta']}>
        <ResultsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Whole Wheat Atta 1kg to cart' }));
    await waitFor(() => expect(addToCart).toHaveBeenCalled());
    expect(await screen.findByText('Whole Wheat Atta 1kg added to cart. Sign in to check out.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View cart' })).toBeInTheDocument();
  });
});
