import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export interface CartItemProps {
  item: {
    item: { id: string; descriptor?: { name: string }; price?: { value?: string; currency: string } };
    quantity: number;
  };
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  disabled: boolean;
}

export function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  disabled,
}: CartItemProps): JSX.Element {
  const handleQuantityChange = async (delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity > 0) {
      await onUpdateQuantity(item.item.id, newQuantity);
    }
  };

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-lg font-semibold tracking-tight">
            {item.item.descriptor?.name || item.item.id}
          </div>
          <div className="text-sm text-muted-foreground">
            {item.item.price?.currency} {item.item.price?.value || '0'} × {item.quantity}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            onClick={() => void handleQuantityChange(-1)}
            disabled={disabled}
          >
            <Minus className="size-4" />
          </Button>
          <div className="min-w-9 text-center text-sm font-semibold">{item.quantity}</div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            onClick={() => void handleQuantityChange(1)}
            disabled={disabled}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => void onRemove(item.item.id)}
            disabled={disabled}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export interface CartSummaryProps {
  subtotal: number;
  currency: string;
  onCheckout: () => void;
  checkoutDisabled: boolean;
}

export function CartSummary({
  subtotal,
  currency,
  onCheckout,
  checkoutDisabled,
}: CartSummaryProps): JSX.Element {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Order summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">
            {currency} {subtotal.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-base font-semibold">
          <span>Total</span>
          <span>
            {currency} {subtotal.toFixed(2)}
          </span>
        </div>
        <Button
          type="button"
          onClick={onCheckout}
          disabled={checkoutDisabled}
          className="w-full rounded-full"
        >
          Proceed to checkout
        </Button>
      </CardContent>
    </Card>
  );
}
