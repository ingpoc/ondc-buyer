import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDetailPage } from './ProductDetailPage';

const execute = vi.fn();
const addToCart = vi.fn();
const productState = vi.hoisted(() => ({ quantity: 7 }));

vi.mock('../hooks', () => ({
  useApi: () => ({
    data: {
      id: 'item-1',
      name: 'Fresh Farm Toor Dal 1kg',
      description: 'Unpolished dal for everyday meals.',
      price: { currency: 'INR', value: '149.00' },
      images: [],
      category: 'Grocery',
      quantity: productState.quantity,
      provider: { id: 'seller-1', name: 'Fresh Farm Foods' },
      deliveryEstimate: '2-4 business days',
      returnPolicy: 'Sealed packs may be returned within 7 days.',
    },
    loading: false,
    error: null,
    execute,
  }),
  useCart: () => ({ addToCart }),
  useAuth: () => ({ isAuthenticated: true }),
}));

describe('ProductDetailPage decision context', () => {
  beforeEach(() => {
    execute.mockReset();
    addToCart.mockReset();
    addToCart.mockResolvedValue({
      items: [{ item: { id: 'item-1', name: 'Fresh Farm Toor Dal 1kg' } }],
    });
    productState.quantity = 7;
  });

  it('exposes a page heading, seller terms, unit price, and quantity choice', async () => {
    render(
      <MemoryRouter initialEntries={['/products/item-1']}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Fresh Farm Toor Dal 1kg' })).toBeInTheDocument();
    expect(screen.getAllByText('Fresh Farm Foods').length).toBeGreaterThan(0);
    expect(screen.getByText('INR 149.00 per kg')).toBeInTheDocument();
    expect(screen.getByText('2-4 business days')).toBeInTheDocument();
    expect(screen.getByText(/returned within 7 days/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    await waitFor(() => expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }), 3));
    expect(await screen.findByText('3 items added to cart.')).toBeInTheDocument();
  });

  it('activates add to cart from the focused button with Enter', async () => {
    render(
      <MemoryRouter initialEntries={['/products/item-1']}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const addButton = screen.getByRole('button', { name: 'Add to cart' });
    addButton.focus();
    fireEvent.keyDown(addButton, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }), 1));
    expect(await screen.findByText('1 item added to cart.')).toBeInTheDocument();
  });

  it('disables quantity and purchase controls when stock is zero', () => {
    productState.quantity = 0;

    render(
      <MemoryRouter initialEntries={['/products/item-1']}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    expect(addToCart).not.toHaveBeenCalled();
  });
});
