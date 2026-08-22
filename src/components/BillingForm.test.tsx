import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalSession } from '../lib/localCart';
import { BillingForm, formatBillingSaveError } from './BillingForm';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function response(status: number) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
  });
}

const session = {
  id: 'session-billing',
  buyer: {
    name: '',
    email: '',
    phone: '',
  },
};

describe('BillingForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps typed values when CommerceV1 buyer persist 404s', async () => {
    window.localStorage.setItem('ondc-session-id', 'session-billing');
    fetchMock.mockImplementation(() => response(404));
    const onDraftChange = vi.fn();

    const { rerender } = render(
      <BillingForm session={session} onDraftChange={onDraftChange} />,
    );

    fireEvent.change(screen.getByLabelText('Full name *'), {
      target: { value: 'Gurusharan Gupta' },
    });
    fireEvent.change(screen.getByLabelText('Email *'), {
      target: { value: 'buyer@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Phone *'), {
      target: { value: '+919876543210' },
    });
    fireEvent.blur(screen.getByLabelText('Phone *'));

    await waitFor(() => {
      expect(screen.getByTestId('buyer-billing-save-warning')).toHaveTextContent('404');
    });
    expect(screen.getByLabelText('Full name *')).toHaveValue('Gurusharan Gupta');
    expect(screen.getByLabelText('Email *')).toHaveValue('buyer@example.test');
    expect(screen.getByLabelText('Phone *')).toHaveValue('+919876543210');
    expect(getLocalSession('session-billing').buyer?.email).toBe('buyer@example.test');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/commerce\/v1\/buyer$/);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/api/cart/buyer');

    rerender(
      <BillingForm
        session={{ id: 'session-billing', buyer: { name: '', email: '', phone: '' } }}
        onDraftChange={onDraftChange}
      />,
    );
    expect(screen.getByLabelText('Full name *')).toHaveValue('Gurusharan Gupta');
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Gurusharan Gupta',
        email: 'buyer@example.test',
        phone: '+919876543210',
      }),
    );
  });
});
