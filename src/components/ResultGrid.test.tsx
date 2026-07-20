import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UCPItem } from '../types';
import { ResultGrid } from './ResultGrid';

describe('ResultGrid customer-facing seller labels', () => {
  it('does not render an internal principal id as the seller name', () => {
    const item = {
      id: 'item-1',
      name: 'Millet flour',
      price: { currency: 'INR', value: '120' },
      images: [],
      provider: { id: 'seller-1', name: 'principal:demo:8bbf5daba84641d4' },
      _provider: 'principal:demo:8bbf5daba84641d4',
    } as UCPItem;

    render(<ResultGrid items={[item]} deliveryArea="Pune" />);

    expect(screen.getAllByText('Seller name unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText('INR 120.00 per listed pack')).toBeInTheDocument();
    expect(screen.getByText('Estimate not supplied')).toBeInTheDocument();
    expect(screen.getByText('Delivers to Pune')).toBeInTheDocument();
    expect(screen.queryByText(/principal:demo:/i)).not.toBeInTheDocument();
  });
});
