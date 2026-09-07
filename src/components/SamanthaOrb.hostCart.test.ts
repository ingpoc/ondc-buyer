import { describe, expect, it } from 'vitest';
import { buildHostCartSummary } from './SamanthaOrb';

describe('Samantha host cart summary', () => {
  it('exposes cart_subtotal_inr and line totals for cart-total asks', () => {
    expect(
      buildHostCartSummary(
        [
          {
            itemId: 'atta-1',
            name: 'Sampoorna Whole Wheat Atta 1kg',
            quantity: 2,
            price_inr: 89,
          },
        ],
        178,
      ),
    ).toEqual({
      live_cart: [
        {
          itemId: 'atta-1',
          name: 'Sampoorna Whole Wheat Atta 1kg',
          quantity: 2,
          price_inr: 89,
          line_total_inr: 178,
        },
      ],
      cart_subtotal_inr: 178,
    });
  });
});
