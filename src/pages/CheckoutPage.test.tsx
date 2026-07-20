import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { UCPAddress } from '../types';
import {
  checkoutDecisionStep,
  DeliveryAddressForm,
  ExactApprovalReview,
} from './CheckoutPage';

function AddressHarness() {
  const [address, setAddress] = useState<UCPAddress>({
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'IND',
  });
  return <DeliveryAddressForm address={address} onChange={setAddress} />;
}

describe('DeliveryAddressForm semantics', () => {
  it('exposes stable textbox names and keeps entered values in the inputs', () => {
    render(<AddressHarness />);

    const street = screen.getByRole('textbox', { name: 'Street address *' });
    const city = screen.getByRole('textbox', { name: 'City *' });
    const state = screen.getByRole('textbox', { name: 'State *' });
    const postalCode = screen.getByRole('textbox', { name: 'Postal code *' });

    fireEvent.change(street, { target: { value: '42 Market Road' } });
    fireEvent.change(city, { target: { value: 'Pune' } });
    fireEvent.change(state, { target: { value: 'Maharashtra' } });
    fireEvent.change(postalCode, { target: { value: '411001' } });

    expect(street).toHaveValue('42 Market Road');
    expect(city).toHaveValue('Pune');
    expect(state).toHaveValue('Maharashtra');
    expect(postalCode).toHaveValue('411001');
  });
});

describe('Exact checkout approval', () => {
  it('stops a need-approval decision at customer review instead of execution', () => {
    expect(
      checkoutDecisionStep({
        decision: 'need_approval',
        reason: 'Amount above automatic limit',
        approval: { approval_id: 'approval-1', amount_inr: 298 },
      }),
    ).toBe('review_exact_approval');
  });

  it('states the exact consequence and requires a separate confirmation action', () => {
    const onConfirm = vi.fn();
    const onKeepReviewing = vi.fn();
    render(
      <ExactApprovalReview
        amountInr={298}
        quantity={2}
        itemName="Fresh Farm Toor Dal 1kg"
        sellerName="Fresh Farm Foods"
        submitting={false}
        approvalAvailable
        onConfirm={onConfirm}
        onKeepReviewing={onKeepReviewing}
      />,
    );

    expect(screen.getByText(/Confirm INR 298\.00 for 2 × Fresh Farm Toor Dal 1kg/)).toBeVisible();
    expect(screen.getByText(/creates the order and reserves this quantity/i)).toBeVisible();
    expect(screen.getByText(/cannot be reused for another order/i)).toBeVisible();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm exact approval and place order' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onKeepReviewing).not.toHaveBeenCalled();
  });
});
