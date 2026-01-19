import { useState } from 'react';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, CARD, DRAMS, DramsInput, DramsRadioGroup, type DramsRadioOption } from '@ondc-sdk/shared/design-system';

export type PaymentMethod = any;

const PAYMENT_OPTIONS: DramsRadioOption[] = [
  {
    value: 'upi',
    label: 'UPI',
    description: 'Pay using any UPI app (GPay, PhonePe, Paytm)',
  },
  {
    value: 'card',
    label: 'Credit / Debit Card',
    description: 'Visa, Mastercard, RuPay',
  },
  {
    value: 'netbanking',
    label: 'Net Banking',
    description: 'Pay from your bank account',
  },
  {
    value: 'wallet',
    label: 'Wallet',
    description: 'Paytm, Amazon Pay, Mobikwik',
  },
  {
    value: 'cod',
    label: 'Cash on Delivery',
    description: 'Pay when you receive the order',
  },
];

const CONTAINER_STYLE = {
  ...CARD.base,
  marginBottom: SPACING.xl,
};

const HEADER_STYLE = {
  ...TYPOGRAPHY.h4,
  color: COLORS.textPrimary,
  margin: `0 0 ${SPACING.lg} 0`,
};

export interface PaymentSelectorProps {
  selected?: PaymentMethod;
  onSelect?: (method: PaymentMethod) => void;
}

export function PaymentSelector({ selected, onSelect }: PaymentSelectorProps): JSX.Element {
  const [internalSelected, setInternalSelected] = useState<PaymentMethod>('upi');

  const currentSelected = selected ?? internalSelected;
  const handleSelect = onSelect ?? setInternalSelected;

  return (
    <div style={CONTAINER_STYLE}>
      <h2 style={HEADER_STYLE}>Payment Method</h2>

      <DramsRadioGroup
        name="payment-method"
        options={PAYMENT_OPTIONS}
        value={currentSelected}
        onChange={handleSelect}
      />

      {currentSelected === 'upi' && (
        <UPIInputForm style={{ marginTop: SPACING.xl }} />
      )}

      {currentSelected === 'card' && (
        <CardInputForm style={{ marginTop: SPACING.xl }} />
      )}
    </div>
  );
}

interface FormWrapperProps {
  style?: React.CSSProperties;
}

const FORM_CONTAINER_STYLE = {
  padding: SPACING.lg,
  backgroundColor: COLORS.bgPage,
  borderRadius: RADIUS.lg,
};

const FORM_LABEL_STYLE = {
  display: 'block',
  marginBottom: SPACING.sm,
  ...TYPOGRAPHY.label,
  color: COLORS.textSecondary,
};

const FORM_HELP_TEXT_STYLE = {
  ...TYPOGRAPHY.bodySmall,
  color: COLORS.textMuted,
  marginTop: SPACING.sm,
  marginBottom: '0',
};

function UPIInputForm({ style }: FormWrapperProps): JSX.Element {
  const [upiId, setUpiId] = useState('');

  return (
    <div style={{ ...FORM_CONTAINER_STYLE, ...style }}>
      <label htmlFor="upi-id" style={FORM_LABEL_STYLE}>
        UPI ID
      </label>
      <DramsInput
        id="upi-id"
        type="text"
        value={upiId}
        onChange={(e) => setUpiId(e.target.value)}
        placeholder="yourname@upi"
        pattern="[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+"
      />
      <p style={FORM_HELP_TEXT_STYLE}>
        Enter your UPI ID (e.g., mobile@upi, username@oksbi)
      </p>
    </div>
  );
}

function formatCardNumber(value: string): string {
  return value
    .replace(/\s/g, '')
    .replace(/(\d{4})/g, '$1 ')
    .trim()
    .substring(0, 19);
}

function formatExpiry(value: string): string {
  if (value.length >= 2) {
    return value.substring(0, 2) + '/' + value.substring(2, 4);
  }
  return value;
}

const GRID_STYLE = {
  display: 'grid',
  gap: SPACING.md,
};

const HALF_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr' as const,
  gap: SPACING.md,
};

const SECURITY_TEXT_STYLE = {
  ...TYPOGRAPHY.bodySmall,
  color: COLORS.textMuted,
  marginTop: SPACING.sm,
  marginBottom: '0',
};

function CardInputForm({ style }: FormWrapperProps): JSX.Element {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');

  return (
    <div style={{ ...FORM_CONTAINER_STYLE, ...style }}>
      <div style={GRID_STYLE}>
        <div>
          <label htmlFor="card-number" style={FORM_LABEL_STYLE}>
            Card Number
          </label>
          <DramsInput
            id="card-number"
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
          />
        </div>

        <div>
          <label htmlFor="cardholder-name" style={FORM_LABEL_STYLE}>
            Cardholder Name
          </label>
          <DramsInput
            id="cardholder-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="JOHN DOE"
          />
        </div>

        <div style={HALF_GRID_STYLE}>
          <div>
            <label htmlFor="card-expiry" style={FORM_LABEL_STYLE}>
              Expiry
            </label>
            <DramsInput
              id="card-expiry"
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value.replace(/\D/g, '')))}
              placeholder="MM/YY"
              maxLength={5}
            />
          </div>

          <div>
            <label htmlFor="card-cvv" style={FORM_LABEL_STYLE}>
              CVV
            </label>
            <DramsInput
              id="card-cvv"
              type="password"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
              placeholder="•••"
              maxLength={4}
            />
          </div>
        </div>
      </div>

      <p style={SECURITY_TEXT_STYLE}>
        🔒 Your card details are secure and encrypted
      </p>
    </div>
  );
}
