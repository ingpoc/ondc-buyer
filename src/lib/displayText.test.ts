import { describe, expect, it } from 'vitest';
import { customerReference, sellerDisplayName, unitPriceLabel } from './displayText';

describe('customer-facing identifiers', () => {
  it('turns internal ids into short references without implementation prefixes', () => {
    expect(customerReference('order_40a99f8ff4ea4d1e')).toBe('40A99F8F');
    expect(customerReference('txn_0a15abd4aa3a460b')).toBe('0A15ABD4');
  });

  it('never exposes principal ids or internal provider slugs as seller names', () => {
    expect(sellerDisplayName(undefined, 'principal:demo:8bbf5daba84641d4')).toBe('Seller name unavailable');
    expect(sellerDisplayName(undefined, 'local-seller')).toBe('Seller name unavailable');
    expect(sellerDisplayName('principal:demo:8bbf5daba84641d4', 'principal:demo:hidden')).toBe(
      'Seller name unavailable',
    );
    expect(sellerDisplayName('local-seller', 'local-seller')).toBe('Seller name unavailable');
    expect(sellerDisplayName('Sunrise Foods', 'principal:demo:hidden')).toBe('Sunrise Foods');
  });

  it('shows normalized unit prices when the pack size is present', () => {
    expect(unitPriceLabel('Toor Dal 1kg', 149)).toBe('INR 149.00 per kg');
    expect(unitPriceLabel('Coffee 500g', 180)).toBe('INR 360.00 per kg');
    expect(unitPriceLabel('Oil 750ml', 150)).toBe('INR 200.00 per L');
    expect(unitPriceLabel('Mixed grocery pack', 99)).toBe('INR 99.00 per listed pack');
  });
});
