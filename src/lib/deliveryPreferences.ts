import type { UCPAddress } from '../types';

export interface SavedDeliveryArea {
  label: string;
  city?: string;
  state?: string;
  postalCode?: string;
  updatedAt: string;
}

function storageKey(principalId: string): string {
  return `buyer-delivery-area:${encodeURIComponent(principalId.slice(0, 160))}`;
}

export function deliveryAreaLabel(address: Partial<UCPAddress>): string {
  return [address.city, address.state, address.postalCode || address.pincode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

export function loadSavedDeliveryArea(
  principalId: string | null | undefined,
): SavedDeliveryArea | null {
  if (!principalId?.trim() || typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(principalId)) || 'null') as
      | Partial<SavedDeliveryArea>
      | null;
    if (!parsed?.label || typeof parsed.label !== 'string') return null;
    return {
      label: parsed.label.trim(),
      city: typeof parsed.city === 'string' ? parsed.city : undefined,
      state: typeof parsed.state === 'string' ? parsed.state : undefined,
      postalCode: typeof parsed.postalCode === 'string' ? parsed.postalCode : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDeliveryAreaFromAddress(
  principalId: string | null | undefined,
  address: Partial<UCPAddress>,
): SavedDeliveryArea | null {
  if (!principalId?.trim() || typeof localStorage === 'undefined') return null;
  const label = deliveryAreaLabel(address);
  if (!label) return null;
  const saved: SavedDeliveryArea = {
    label,
    city: String(address.city || '').trim() || undefined,
    state: String(address.state || '').trim() || undefined,
    postalCode: String(address.postalCode || address.pincode || '').trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(principalId), JSON.stringify(saved));
  return saved;
}

export function saveDeliveryAreaLabel(
  principalId: string | null | undefined,
  label: string,
): SavedDeliveryArea | null {
  if (!principalId?.trim() || typeof localStorage === 'undefined') return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  const current = loadSavedDeliveryArea(principalId);
  const isPostalCode = /^\d{6}$/.test(trimmed);
  const sameLabel = current?.label === trimmed;
  const saved: SavedDeliveryArea = {
    label: trimmed,
    city: sameLabel ? current?.city : (!isPostalCode && !trimmed.includes(',') ? trimmed : undefined),
    state: sameLabel ? current?.state : undefined,
    postalCode: sameLabel ? current?.postalCode : (isPostalCode ? trimmed : undefined),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(principalId), JSON.stringify(saved));
  return saved;
}
