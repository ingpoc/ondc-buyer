import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Field, FieldDescription, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';

const PAYMENT_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
}> = [
  {
    value: 'upi',
    label: 'UPI',
    description: 'Pay using any UPI app like GPay, PhonePe, or Paytm.',
  },
  {
    value: 'card',
    label: 'Card',
    description: 'Use a credit or debit card for the payment.',
  },
  {
    value: 'netbanking',
    label: 'Net banking',
    description: 'Complete payment directly from your bank account.',
  },
  {
    value: 'wallet',
    label: 'Wallet',
    description: 'Use a supported wallet for a faster buyer flow.',
  },
  {
    value: 'cod',
    label: 'Cash on delivery',
    description: 'Pay when the delivery reaches you.',
  },
];

export interface PaymentSelectorProps {
  selected?: PaymentMethod;
  onSelect?: (method: PaymentMethod) => void;
}

function formatCardNumber(value: string): string {
  return value
    .replace(/\s/g, '')
    .replace(/(\d{4})/g, '$1 ')
    .trim()
    .substring(0, 19);
}

function formatExpiry(value: string): string {
  const next = value.replace(/\D/g, '').slice(0, 4);
  if (next.length < 3) {
    return next;
  }
  return `${next.slice(0, 2)}/${next.slice(2, 4)}`;
}

export function PaymentSelector({ selected, onSelect }: PaymentSelectorProps): JSX.Element {
  const [internalSelected, setInternalSelected] = useState<PaymentMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');

  const currentSelected = selected ?? internalSelected;
  const handleSelect = onSelect ?? setInternalSelected;

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Payment
        </div>
        <CardTitle className="text-xl">Payment method</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={currentSelected} onValueChange={(value) => handleSelect(value as PaymentMethod)}>
          <TabsList className="h-auto w-full flex-wrap rounded-3xl">
            {PAYMENT_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value} className="rounded-full">
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {PAYMENT_OPTIONS.map((option) => (
            <TabsContent key={option.value} value={option.value} className="mt-6 space-y-4">
              <div className="text-sm text-muted-foreground">{option.description}</div>

              {option.value === 'upi' ? (
                <Field>
                  <FieldLabel htmlFor="upi-id">UPI ID</FieldLabel>
                  <Input
                    id="upi-id"
                    value={upiId}
                    onChange={(event) => setUpiId(event.target.value)}
                    placeholder="yourname@upi"
                  />
                  <FieldDescription>
                    Enter a UPI handle like mobile@upi or username@oksbi.
                  </FieldDescription>
                </Field>
              ) : null}

              {option.value === 'card' ? (
                <div className="grid gap-5">
                  <Field>
                    <FieldLabel htmlFor="card-number">Card number</FieldLabel>
                    <Input
                      id="card-number"
                      value={cardNumber}
                      onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                      placeholder="1234 5678 9012 3456"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="cardholder-name">Cardholder name</FieldLabel>
                    <Input
                      id="cardholder-name"
                      value={name}
                      onChange={(event) => setName(event.target.value.toUpperCase())}
                      placeholder="JOHN DOE"
                    />
                  </Field>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="card-expiry">Expiry</FieldLabel>
                      <Input
                        id="card-expiry"
                        value={expiry}
                        onChange={(event) => setExpiry(formatExpiry(event.target.value))}
                        placeholder="MM/YY"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="card-cvv">CVV</FieldLabel>
                      <Input
                        id="card-cvv"
                        type="password"
                        value={cvv}
                        onChange={(event) => setCvv(event.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="•••"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
