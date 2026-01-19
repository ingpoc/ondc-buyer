import { useState, useEffect, useCallback, useMemo } from 'react';
import { COLORS, SPACING, TYPOGRAPHY, BUTTON, CARD, BADGE, DRAMS, DramsInput } from '@ondc-sdk/shared/design-system';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STORAGE_KEY = 'ondc-session-id';

const FORM_CONTAINER_STYLE = {
  ...CARD.base,
  marginBottom: SPACING.xl,
} as const;

const LABEL_STYLE = {
  display: 'block' as const,
  marginBottom: SPACING.sm,
  ...TYPOGRAPHY.label,
  color: COLORS.textPrimary,
};

const SAVED_BADGE_STYLE = {
  ...BADGE.success,
  marginBottom: SPACING.lg,
} as const;

export interface BillingFormProps {
  session: any;
  onSave?: () => void | Promise<void>;
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  pattern?: string;
  maxLength?: number;
  onBlur?: () => void;
  style?: React.CSSProperties;
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  pattern,
  maxLength,
  onBlur,
  style,
}: FormFieldProps): React.ReactElement {
  return (
    <div style={style}>
      <label style={LABEL_STYLE}>
        {label} {required && '*'}
      </label>
      <DramsInput
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        pattern={pattern}
        maxLength={maxLength}
      />
    </div>
  );
}

export function BillingForm({ session, onSave }: BillingFormProps): React.ReactElement {
  const [name, setName] = useState(session?.buyer?.name || '');
  const [email, setEmail] = useState(session?.buyer?.email || '');
  const [phone, setPhone] = useState(session?.buyer?.phone || '');
  const [taxId, setTaxId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (session?.buyer) {
      setName(session.buyer.name || '');
      setEmail(session.buyer.email || '');
      setPhone(session.buyer.phone || '');
    }
  }, [session]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) return;

    setSaving(true);
    setSaved(false);

    try {
      const sessionId = localStorage.getItem(STORAGE_KEY);
      if (!sessionId) {
        throw new Error('No session found');
      }

      const response = await fetch(`${API_BASE}/api/cart/buyer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name, email, phone, taxId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save: ${response.status}`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Notify parent component to refresh session
      await onSave?.();
    } catch (err) {
      console.error('Failed to save buyer info:', err);
    } finally {
      setSaving(false);
    }
  }, [name, email, phone, taxId]);

  const isDirty = useMemo(
    () =>
      name !== (session?.buyer?.name || '') ||
      email !== (session?.buyer?.email || '') ||
      phone !== (session?.buyer?.phone || '') ||
      taxId !== '',
    [name, email, phone, taxId, session]
  );

  const isValid = useMemo(
    () => name.trim() !== '' && email.trim() !== '' && phone.trim() !== '',
    [name, email, phone]
  );

  return (
    <div style={FORM_CONTAINER_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
        <h2 style={{ ...TYPOGRAPHY.h3, color: DRAMS.textDark, margin: 0 }}>Billing Information</h2>
        {isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isValid}
            style={{
              ...BUTTON.primary,
              opacity: saving || !isValid ? 0.5 : 1,
              cursor: saving || !isValid ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {saved && (
        <div style={SAVED_BADGE_STYLE}>
          ✓ Information saved
        </div>
      )}

      <div style={{ display: 'grid', gap: SPACING.lg }}>
        <FormField
          label="Full Name"
          value={name}
          onChange={setName}
          onBlur={handleSave}
          placeholder="John Doe"
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg }}>
          <FormField
            label="Email"
            value={email}
            onChange={setEmail}
            onBlur={handleSave}
            placeholder="john@example.com"
            type="email"
            required
          />
          <FormField
            label="Phone"
            value={phone}
            onChange={setPhone}
            onBlur={handleSave}
            placeholder="+919876543210"
            type="tel"
            required
          />
        </div>

        <FormField
          label="GSTIN (Optional)"
          value={taxId}
          onChange={(value) => setTaxId(value.toUpperCase())}
          onBlur={handleSave}
          placeholder="29ABCDE1234F1Z5"
          maxLength={15}
        />
        <p style={{ ...TYPOGRAPHY.bodySmall, color: COLORS.textMuted, marginTop: `-${SPACING.md}` }}>
          For business purchases and GST invoices
        </p>
      </div>
    </div>
  );
}
