import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { UCPAddress } from '../types';
import {
  checkoutActionDisabled,
  checkoutAuthorizeButtonLabel,
  checkoutFormReady,
  checkoutDecisionStep,
  checkoutPaymentDetailsCopy,
  collapseDuplicatedRegion,
  DeliveryAddressForm,
  ExactApprovalReview,
  shouldRedirectEmptyCheckout,
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

  it('collapses a duplicated state value instead of showing KarnatakaKarnataka', () => {
    render(<AddressHarness />);
    const state = screen.getByRole('textbox', { name: 'State *' });
    fireEvent.change(state, { target: { value: 'KarnatakaKarnataka' } });
    expect(state).toHaveValue('Karnataka');
  });
});

describe('checkout form readiness', () => {
  const completeAddress: UCPAddress = {
    line1: '42 Market Road',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    country: 'IND',
  };

  it('requires both customer identity and a complete six-digit delivery address', () => {
    const session = {
      buyer: {
        name: 'Gurusharan Gupta',
        email: 'buyer@example.com',
        phone: '+919876543210',
        contact: { email: 'buyer@example.com' },
      },
    };

    expect(checkoutFormReady(session, completeAddress)).toBe(true);
    expect(checkoutFormReady(session, { ...completeAddress, postalCode: '4110' })).toBe(false);
    expect(checkoutFormReady({ buyer: { ...session.buyer, name: '' } }, completeAddress)).toBe(false);
  });

  it('keeps exact authorization disabled until the shopping mandate is saved', () => {
    expect(
      checkoutActionDisabled({
        submitting: false,
        trustBlocksCheckout: false,
        formReady: true,
        authorizationReady: false,
      }),
    ).toBe(true);

    expect(
      checkoutActionDisabled({
        submitting: false,
        trustBlocksCheckout: false,
        formReady: true,
        authorizationReady: true,
      }),
    ).toBe(false);
  });
});

describe('Exact checkout approval', () => {
  it('stops a need-approval decision at customer review instead of execution', () => {
    expect(
      checkoutDecisionStep({
        decision: 'need_approval',
        decision_id: 'decision-1',
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

  it('names Razorpay Test Mode when sandbox checkout is on', () => {
    render(
      <ExactApprovalReview
        amountInr={178}
        quantity={1}
        itemName="Atta"
        sellerName="Sunrise Foods"
        submitting={false}
        approvalAvailable
        razorpayTestMode
        onConfirm={() => undefined}
        onKeepReviewing={() => undefined}
      />,
    );

    expect(screen.getByText(/Razorpay Checkout Test Mode/i)).toBeVisible();
    expect(screen.getByText(/no real money/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm exact approval and pay in Test Mode' })).toBeVisible();
  });
});

describe('checkout payment rail copy', () => {
  it('keeps the simulated authorize path when Razorpay sandbox is off', () => {
    expect(checkoutPaymentDetailsCopy(false)).toMatch(/No bank, card, UPI/i);
    expect(
      checkoutAuthorizeButtonLabel({
        trustBlocksCheckout: false,
        submitting: false,
        prepared: true,
        razorpayTestMode: false,
      }),
    ).toBe('Authorize exact total and place order');
  });

  it('labels Checkout Test Mode and no real money when Razorpay sandbox is on', () => {
    expect(checkoutPaymentDetailsCopy(true)).toMatch(/Test Mode/i);
    expect(checkoutPaymentDetailsCopy(true)).toMatch(/no real money/i);
    expect(
      checkoutAuthorizeButtonLabel({
        trustBlocksCheckout: false,
        submitting: false,
        prepared: true,
        razorpayTestMode: true,
      }),
    ).toBe('Pay with Razorpay Test Mode');
  });
});

describe('checkout empty-cart redirect', () => {
  it('does not navigate away for guests or after items were already present', () => {
    expect(collapseDuplicatedRegion('KarnatakaKarnataka')).toBe('Karnataka');
    expect(
      shouldRedirectEmptyCheckout({
        authenticated: false,
        holdingDecision: false,
        loading: false,
        itemCount: 0,
        hadItems: false,
      }),
    ).toBe(false);
    expect(
      shouldRedirectEmptyCheckout({
        authenticated: true,
        holdingDecision: false,
        loading: false,
        itemCount: 0,
        hadItems: true,
      }),
    ).toBe(false);
    expect(
      shouldRedirectEmptyCheckout({
        authenticated: true,
        holdingDecision: false,
        loading: false,
        itemCount: 0,
        hadItems: false,
      }),
    ).toBe(true);
  });
});
