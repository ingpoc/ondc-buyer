import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from './ui/field';
import { Input } from './ui/input';
import { buildCommerceUrl, COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { updateLocalBuyer } from '../lib/localCart';

const STORAGE_KEY = 'ondc-session-id';

export interface BillingFormProps {
  session: any;
  onSave?: () => void | Promise<void>;
}

export function BillingForm({ session, onSave }: BillingFormProps): React.ReactElement {
  const fieldPrefix = useId();
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
    if (!name.trim() || !email.trim() || !phone.trim()) {
      return;
    }

    setSaving(true);
    setSaved(false);
    const sessionId = localStorage.getItem(STORAGE_KEY);

    try {
      if (!sessionId) {
        throw new Error('No session found');
      }

      if (COMMERCE_DEMO_MODE) {
        updateLocalBuyer(sessionId, { name, email, phone, taxId });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await onSave?.();
        return;
      }

      const response = await fetch(buildCommerceUrl(`/api/cart/buyer/${sessionId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, taxId }),
      });

      if (!response.ok) {
        throw new Error(`Billing save failed: ${response.status}`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await onSave?.();
    } finally {
      setSaving(false);
    }
  }, [email, name, onSave, phone, taxId]);

  const isDirty = useMemo(
    () =>
      name !== (session?.buyer?.name || '') ||
      email !== (session?.buyer?.email || '') ||
      phone !== (session?.buyer?.phone || '') ||
      taxId !== '',
    [email, name, phone, session, taxId],
  );

  const isValid = useMemo(
    () => name.trim() !== '' && email.trim() !== '' && phone.trim() !== '',
    [email, name, phone],
  );

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Buyer details
          </div>
          <CardTitle className="text-xl">Billing information</CardTitle>
        </div>
        {isDirty ? (
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isValid}
            className="rounded-full"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {saved ? (
          <Badge variant="secondary" className="rounded-full bg-lime-100 text-lime-900">
            Information saved
          </Badge>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${fieldPrefix}-full-name`}>Full name *</FieldLabel>
            <Input
              id={`${fieldPrefix}-full-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => void handleSave()}
              placeholder="John Doe"
              required
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${fieldPrefix}-email`}>Email *</FieldLabel>
              <Input
                id={`${fieldPrefix}-email`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => void handleSave()}
                placeholder="john@example.com"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${fieldPrefix}-phone`}>Phone *</FieldLabel>
              <Input
                id={`${fieldPrefix}-phone`}
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                onBlur={() => void handleSave()}
                placeholder="+919876543210"
                required
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor={`${fieldPrefix}-tax-id`}>GSTIN</FieldLabel>
            <Input
              id={`${fieldPrefix}-tax-id`}
              value={taxId}
              onChange={(event) => setTaxId(event.target.value.toUpperCase())}
              onBlur={() => void handleSave()}
              placeholder="29ABCDE1234F1Z5"
              maxLength={15}
            />
            <FieldDescription>
              Optional, used for business purchases and GST invoices.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
