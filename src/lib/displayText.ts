export function customerReference(value: string | null | undefined): string {
  const withoutPrefix = String(value ?? '').replace(/^[a-z]+[_:-]+/i, '');
  const compact = withoutPrefix.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return compact.slice(0, 8) || 'PENDING';
}

/** Buyer-facing Intent Receipt label; keep the technical id as the short reference. */
export function intentReceiptLabel(receiptId?: string | null): string {
  const reference = customerReference(receiptId);
  return receiptId ? `Intent Receipt ${reference}` : 'Intent Receipt';
}

export function sellerDisplayName(
  providerName: string | null | undefined,
  providerId: string | null | undefined,
): string {
  const isCustomerFacing = (value: string | undefined): value is string =>
    Boolean(value && !value.includes(':') && value !== 'local-seller');

  const name = providerName?.trim();
  if (isCustomerFacing(name)) return name;

  const candidate = providerId?.trim();
  return isCustomerFacing(candidate) ? candidate : 'Seller name unavailable';
}

export function unitPriceLabel(
  title: string | null | undefined,
  rawPrice: string | number | null | undefined,
  currency = 'INR',
): string {
  const price = Number(rawPrice);
  const safePrice = Number.isFinite(price) ? price : 0;
  const match = String(title ?? '').match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/i);

  if (!match) return `${currency} ${safePrice.toFixed(2)} per listed pack`;

  const quantity = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return `${currency} ${safePrice.toFixed(2)} per listed pack`;
  }

  const baseQuantity = unit === 'g' || unit === 'ml' ? quantity / 1000 : quantity;
  const baseUnit = unit === 'kg' || unit === 'g' ? 'kg' : 'L';
  return `${currency} ${(safePrice / baseQuantity).toFixed(2)} per ${baseUnit}`;
}
