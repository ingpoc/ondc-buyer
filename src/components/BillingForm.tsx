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
import { persistBuyerBilling, type BuyerBilling } from '../lib/buyerBilling';

const STORAGE_KEY = 'ondc-session-id';

export interface BillingDraft {
  name: string;
  email: string;
  phone: string;
  taxId: string;
}

export interface BillingFormProps {
  session: any;
  onSave?: () => void | Promise<void>;
  onDraftChange?: (draft: BillingDraft) => void;
}

export function formatBillingSaveError(error: unknown): string {
  return error instanceof Error ? error.message : 'Billing save failed.';
}

function buyerDraftFromSession(session: any): BillingDraft {
  return {
    name: session?.buyer?.name || '',
    email: session?.buyer?.email || session?.buyer?.contact?.email || '',
    phone: session?.buyer?.phone || session?.buyer?.contact?.phone || '',
    taxId: session?.buyer?.taxId || '',
  };
}

export function BillingForm({ session, onSave, onDraftChange }: BillingFormProps): React.ReactElement {
  const fieldPrefix = useId();
  const seeded = buyerDraftFromSession(session);
  const [name, setName] = useState(seeded.name);
  const [email, setEmail] = useState(seeded.email);
  const [phone, setPhone] = useState(seeded.phone);
  const [taxId, setTaxId] = useState(seeded.taxId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  const emitDraft = useCallback(
    (draft: BillingDraft) => {
      onDraftChange?.(draft);
    },
    [onDraftChange],
  );

  useEffect(() => {
    emitDraft({ name, email, phone, taxId });
  }, [email, emitDraft, name, phone, taxId]);

  useEffect(() => {
    const next = buyerDraftFromSession(session);
    setName((prev) => prev || next.name);
    setEmail((prev) => prev || next.email);
    setPhone((prev) => prev || next.phone);
    setTaxId((prev) => prev || next.taxId);
  }, [session?.id, session?.buyer?.name, session?.buyer?.email, session?.buyer?.phone, session?.buyer?.taxId]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      return;
    }

    setSaving(true);
    setSaved(false);
    setSaveError(null);
    setSaveWarning(null);
    const sessionId = localStorage.getItem(STORAGE_KEY);

    try {
      if (!sessionId) {
        throw new Error('No session found');
      }

      const billing: BuyerBilling = { name, email, phone, taxId };
      const result = await persistBuyerBilling(sessionId, billing);
      if (result.warning) {
        setSaveWarning(result.warning);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
      await onSave?.();
    } catch (error) {
      setSaveError(formatBillingSaveError(error));
    } finally {
      setSaving(false);
    }
  }, [email, name, onSave, phone, taxId]);

  const isDirty = useMemo(
    () =>
      name !== (session?.buyer?.name || '') ||
      email !== (session?.buyer?.email || session?.buyer?.contact?.email || '') ||
      phone !== (session?.buyer?.phone || session?.buyer?.contact?.phone || '') ||
      taxId !== (session?.buyer?.taxId || ''),
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
          <Badge variant="secondary" className="rounded-full bg-primary/15 text-primary">
            Information saved
          </Badge>
        ) : null}
        {saveWarning ? (
          <Badge
            variant="secondary"
            className="rounded-full bg-amber-100 text-amber-900"
            data-testid="buyer-billing-save-warning"
          >
            {saveWarning}
          </Badge>
        ) : null}
        {saveError ? (
          <Badge variant="secondary" className="rounded-full bg-rose-100 text-rose-800">
            {saveError}
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
