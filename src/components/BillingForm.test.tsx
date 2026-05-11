import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BillingForm, formatBillingSaveError } from './BillingForm';

const session = {
  buyer: {
    name: 'Buyer One',
    email: 'buyer@example.test',
    phone: '+919876543210',
  },
};

describe('BillingForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('formats live billing save failures for display', () => {
    expect(formatBillingSaveError(new Error('Billing save failed: 503'))).toBe(
      'Billing save failed: 503',
    );
    expect(formatBillingSaveError('bad response')).toBe('Billing save failed.');
  });

  it('surfaces a missing session before live billing save', async () => {
    render(<BillingForm session={session} />);

    fireEvent.change(screen.getByLabelText('Full name *'), {
      target: { value: 'Buyer Two' },
    });
    fireEvent.blur(screen.getByLabelText('Full name *'));

    await waitFor(() => {
      expect(screen.getByText('No session found')).toBeInTheDocument();
    });
  });
});
