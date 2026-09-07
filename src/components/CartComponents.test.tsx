import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CartItem, CartSummary } from './CartComponents';

describe('CartItem quantity controls', () => {
  it('names the icon controls and sends the next exact quantity', () => {
    const onUpdateQuantity = vi.fn().mockResolvedValue(undefined);
    render(
      <CartItem
        item={{
          item: {
            id: 'toor-dal-1',
            name: 'Fresh Farm Toor Dal 1kg',
            price: { currency: 'INR', value: '149.00' },
          },
          quantity: 1,
        }}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={vi.fn().mockResolvedValue(undefined)}
        disabled={false}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Increase quantity of Fresh Farm Toor Dal 1kg' }),
    );
    expect(onUpdateQuantity).toHaveBeenCalledWith('toor-dal-1', 2);
    expect(
      screen.getByRole('button', { name: 'Decrease quantity of Fresh Farm Toor Dal 1kg' }),
    ).toBeEnabled();
  });
});

describe('CartSummary proceed CTA', () => {
  it('exposes a real /checkout link so navigation does not depend on button onClick alone', () => {
    const onCheckout = vi.fn();
    render(
      <MemoryRouter>
        <CartSummary
          subtotal={89}
          currency="INR"
          onCheckout={onCheckout}
          checkoutDisabled={false}
        />
      </MemoryRouter>,
    );

    const cta = screen.getByRole('link', { name: 'Proceed to checkout' });
    expect(cta).toHaveAttribute('href', '/checkout');
    fireEvent.click(cta);
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('blocks navigation while checkout is disabled', () => {
    const onCheckout = vi.fn();
    render(
      <MemoryRouter>
        <CartSummary
          subtotal={89}
          currency="INR"
          onCheckout={onCheckout}
          checkoutDisabled={true}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Proceed to checkout' }));
    expect(onCheckout).not.toHaveBeenCalled();
  });
});
